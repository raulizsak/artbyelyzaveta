// @ts-nocheck -- Supabase Edge Functions are checked by Deno, not the Next.js compiler.
import Stripe from "npm:stripe@22.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const stripe = new Stripe(stripeSecret);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

function id(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value)
    return String(value.id);
  return null;
}

function eventData(event: Stripe.Event) {
  const object = event.data.object as Record<string, unknown>;
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const base: Record<string, unknown> = {
    order_id: metadata.order_id ?? null,
    session_id: event.type.startsWith("checkout.session") ? object.id : null,
    payment_intent_id:
      id(object.payment_intent) ??
      (event.type.startsWith("payment_intent") ? String(object.id) : null),
    customer_id: id(object.customer),
  };
  if (event.type.startsWith("checkout.session")) {
    base.amount_total = object.amount_total;
    base.payment_status = object.payment_status;
  }
  if (event.type.startsWith("refund.")) {
    base.refund_id = object.id;
    base.amount_refunded = object.amount;
    base.refund_status = object.status;
    base.reason = object.reason;
    base.failure_reason = object.failure_reason;
  }
  if (event.type === "charge.refunded") {
    base.payment_intent_id = id(object.payment_intent);
    base.amount_refunded = object.amount_refunded;
    base.refund_status = object.refunded ? "succeeded" : "pending";
  }
  return base;
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (
    !stripeSecret.startsWith("sk_test_") ||
    !webhookSecret ||
    !supabaseUrl ||
    !serviceRole
  )
    return new Response("Webhook is not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  try {
    const body = await request.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (event.type === "setup_intent.succeeded") {
      const setup = event.data.object as Stripe.SetupIntent;
      const userId = setup.metadata?.user_id;
      const paymentMethodId = id(setup.payment_method);
      if (!userId || !paymentMethodId)
        return new Response("Setup metadata unavailable", { status: 400 });
      const paymentMethod =
        await stripe.paymentMethods.retrieve(paymentMethodId);
      if (!paymentMethod.card)
        return new Response("Card metadata unavailable", { status: 400 });
      const { error: setupError } = await supabase.rpc(
        "process_setup_intent_event",
        {
          p_event_id: event.id,
          p_user_id: userId,
          p_payment_method_id: paymentMethod.id,
          p_brand: paymentMethod.card.brand,
          p_last4: paymentMethod.card.last4,
          p_exp_month: paymentMethod.card.exp_month,
          p_exp_year: paymentMethod.card.exp_year,
        },
      );
      if (setupError)
        return new Response("Setup processing failed", { status: 500 });
      return Response.json({ received: true });
    }
    if (event.type.startsWith("refund.") || event.type === "charge.refunded") {
      const object = event.data.object as Record<string, unknown>;
      const refundEvent = event.type.startsWith("refund.");
      const paymentIntentId = id(object.payment_intent);
      if (!paymentIntentId)
        return new Response("Payment relationship unavailable", {
          status: 400,
        });
      const status = refundEvent
        ? String(object.status ?? "pending")
        : object.refunded
          ? "succeeded"
          : "pending";
      const { data: refundResult, error: refundError } = await supabase.rpc(
        "process_refund_event",
        {
          p_event_id: event.id,
          p_event_type: event.type,
          p_payment_intent_id: paymentIntentId,
          p_refund_id: refundEvent ? String(object.id) : null,
          p_amount_cents: Number(
            refundEvent ? object.amount : object.amount_refunded,
          ),
          p_status: status,
          p_reason: refundEvent ? (object.reason ?? null) : null,
          p_failure_reason: refundEvent
            ? (object.failure_reason ?? null)
            : null,
        },
      );
      if (
        refundError ||
        (refundResult as { status?: string } | null)?.status === "failed"
      )
        return new Response("Refund processing failed", { status: 500 });
      const refundOrderId = (refundResult as { order_id?: string } | null)
        ?.order_id;
      if (refundOrderId) {
        await fetch(`${supabaseUrl}/functions/v1/email-outbox`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRole}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ orderId: refundOrderId }),
        }).catch(() => undefined);
      }
      return Response.json({ received: true });
    }
    const { data, error } = await supabase.rpc("process_stripe_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_data: eventData(event),
    });
    if (error || (data as { status?: string } | null)?.status === "failed") {
      console.error("Stripe event processing failed", {
        eventId: event.id,
        eventType: event.type,
      });
      return new Response("Processing failed", { status: 500 });
    }
    const orderId = (data as { order_id?: string } | null)?.order_id;
    if (orderId) {
      await fetch(`${supabaseUrl}/functions/v1/email-outbox`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRole}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      }).catch(() => undefined);
    }
    return Response.json({ received: true });
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }
});
