import type Stripe from "stripe";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import type { StripeMode } from "@/lib/env";
import { syncPaintingCatalog } from "@/lib/stripe/catalog";
import { ensureStripeInvoiceForOrder } from "@/lib/stripe/invoices";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const webhookSecret = (mode: StripeMode) =>
  process.env[
    mode === "live"
      ? "STRIPE_LIVE_WEBHOOK_SECRET"
      : "STRIPE_TEST_WEBHOOK_SECRET"
  ]?.trim();

function verifyEvent(payload: string, signature: string) {
  for (const mode of ["test", "live"] as const) {
    const secret = webhookSecret(mode);
    if (!secret) continue;
    try {
      const event = getStripe(mode, false).webhooks.constructEvent(
        payload,
        signature,
        secret,
      );
      if (event.livemode !== (mode === "live")) continue;
      return { event, mode };
    } catch {
      // Each mode has a distinct webhook signing secret.
    }
  }
  return null;
}

function normalizedData(event: Stripe.Event) {
  const object = event.data.object;
  if (object.object === "checkout.session") {
    const session = object as Stripe.Checkout.Session;
    return {
      order_id: session.metadata?.order_id ?? null,
      session_id: session.id,
      payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      customer_id:
        typeof session.customer === "string"
          ? session.customer
          : (session.customer?.id ?? null),
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      amount_discount: session.total_details?.amount_discount ?? 0,
      amount_shipping: session.total_details?.amount_shipping ?? 0,
      currency: session.currency,
    };
  }
  if (object.object === "payment_intent") {
    const intent = object as Stripe.PaymentIntent;
    return {
      order_id: intent.metadata.order_id ?? null,
      payment_intent_id: intent.id,
      customer_id:
        typeof intent.customer === "string"
          ? intent.customer
          : (intent.customer?.id ?? null),
      amount_total: intent.amount_received || intent.amount,
      currency: intent.currency,
    };
  }
  if (object.object === "refund") {
    const refund = object as Stripe.Refund;
    return {
      order_id: refund.metadata?.order_id ?? null,
      refund_id: refund.id,
      payment_intent_id:
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : (refund.payment_intent?.id ?? null),
      amount_refunded: refund.amount,
      refund_status: refund.status,
      reason: refund.reason,
      failure_reason: refund.failure_reason,
    };
  }
  if (object.object === "charge") {
    const charge = object as Stripe.Charge;
    return {
      order_id: charge.metadata.order_id ?? null,
      payment_intent_id:
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null),
      amount_refunded: charge.amount_refunded,
      refund_status: charge.refunded ? "succeeded" : "pending",
      refund_id: charge.refunds?.data[0]?.id ?? null,
    };
  }
  return {};
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Invalid signature", { status: 400 });
  const payload = await request.text();
  const verified = verifyEvent(payload, signature);
  if (!verified) return new Response("Invalid signature", { status: 400 });

  const admin = createAdminClient();
  const data = normalizedData(verified.event);
  const { data: result, error } = await admin.rpc(
    "process_commerce_stripe_event",
    {
      p_event_id: verified.event.id,
      p_event_type: verified.event.type,
      p_mode: verified.mode,
      p_data: data,
    },
  );
  if (error || (result as { status?: string } | null)?.status === "failed")
    return new Response("Event processing failed", { status: 500 });

  const processedOrderId = (result as { order_id?: string } | null)?.order_id;
  const orderId =
    typeof data.order_id === "string" ? data.order_id : processedOrderId;
  const resultStatus = (result as { status?: string } | null)?.status;
  const isPaymentSuccess =
    [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "payment_intent.succeeded",
    ].includes(verified.event.type) &&
    (verified.event.type !== "checkout.session.completed" ||
      data.payment_status === "paid");
  if (orderId && resultStatus === "processed") {
    await triggerEmailOutbox(orderId);
  }
  const canChangeInventory =
    isPaymentSuccess ||
    [
      "refund.created",
      "refund.updated",
      "charge.refunded",
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
      "payment_intent.canceled",
    ].includes(verified.event.type);
  if (
    orderId &&
    canChangeInventory &&
    ["processed", "duplicate"].includes(resultStatus ?? "")
  ) {
    try {
      const { data: items, error: itemsError } = await admin
        .from("order_items")
        .select("painting_id")
        .eq("order_id", orderId)
        .not("painting_id", "is", null);
      if (itemsError) throw itemsError;
      const syncResults = await Promise.all(
        (items ?? []).map((item) => syncPaintingCatalog(item.painting_id!)),
      );
      if (syncResults.flat().some((entry) => entry.status === "error"))
        return new Response("Catalogue processing failed", { status: 500 });
    } catch {
      // Retry external side effects even when the database event is a duplicate.
      return new Response("Catalogue processing failed", { status: 500 });
    }
  }
  if (orderId && isPaymentSuccess) {
    try {
      await ensureStripeInvoiceForOrder(orderId, verified.mode);
    } catch {
      // Stripe will retry. Invoice creation is independently idempotent, including
      // when the commerce state transition was already processed on the first attempt.
      return new Response("Invoice processing failed", { status: 500 });
    }
  }
  return Response.json({ received: true });
}
