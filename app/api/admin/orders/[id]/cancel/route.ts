import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import {
  expireUnpaidOrderSession,
  getOrderStripe,
} from "@/lib/stripe/order-payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  reason: z.string().trim().min(3).max(500),
  notify: z.boolean(),
  restock: z.boolean(),
  idempotencyKey: z.uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const orderId = (await params).id;
  const parsed = schema.safeParse(await request.json());
  if (!z.uuid().safeParse(orderId).success || !parsed.success)
    return NextResponse.json(
      { error: "Add a cancellation reason and review the options." },
      { status: 400 },
    );

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, customer_email, payment_status, fulfillment_status, total_cents, amount_refunded_cents, stripe_payment_intent_id, stripe_checkout_session_id, stripe_mode, is_demo, order_items(painting_id)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order unavailable" }, { status: 404 });
  if (["shipped", "delivered"].includes(order.fulfillment_status))
    return NextResponse.json(
      { error: "Use the return workflow after an artwork has shipped." },
      { status: 409 },
    );

  const paid = ["paid", "partially_refunded"].includes(order.payment_status);
  if (!paid) {
    if (!order.is_demo) {
      try {
        await expireUnpaidOrderSession(order);
      } catch {
        return NextResponse.json(
          {
            error:
              "The Stripe payment could not be safely closed. Refresh the order and check payment status before cancelling.",
          },
          { status: 409 },
        );
      }
    }
    const { error } = await (
      await createClient()
    ).rpc("admin_update_order", {
      p_order_id: order.id,
      p_action: "cancel",
      p_notify: parsed.data.notify,
      p_changes: {
        order_status: "cancelled",
        fulfillment_status: "cancelled",
        customer_status_message: parsed.data.notify
          ? parsed.data.reason
          : undefined,
        internal_admin_notes: `Cancellation reason: ${parsed.data.reason}`,
      },
    });
    if (error)
      return NextResponse.json(
        { error: "The order could not be cancelled." },
        { status: 409 },
      );
    if (!parsed.data.restock) {
      const paintingIds = (
        order.order_items as unknown as { painting_id: string | null }[]
      )
        .map((item) => item.painting_id)
        .filter((id): id is string => Boolean(id));
      if (paintingIds.length)
        await admin
          .from("paintings")
          .update({ status: "archived" })
          .in("id", paintingIds)
          .eq("status", "available");
    }
    if (parsed.data.notify) await triggerEmailOutbox(order.id);
    return NextResponse.json({ status: "cancelled" });
  }

  const remaining = order.total_cents - order.amount_refunded_cents;
  if (order.is_demo) {
    const { error } = await admin.rpc("process_demo_refund", {
      p_order_id: order.id,
      p_amount_cents: remaining,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_actor_user_id: user.id,
      p_cancel_order: true,
      p_restock: parsed.data.restock,
      p_notify: parsed.data.notify,
    });
    if (error)
      return NextResponse.json(
        { error: "The demo order could not be cancelled." },
        { status: 409 },
      );
    if (parsed.data.notify) await triggerEmailOutbox(order.id);
    return NextResponse.json({ status: "succeeded", demo: true });
  }
  if (!order.stripe_payment_intent_id || remaining <= 0)
    return NextResponse.json(
      { error: "No refundable payment remains." },
      { status: 409 },
    );

  try {
    const refund = await getOrderStripe(order).refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        amount: remaining,
        reason: "requested_by_customer",
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `cancel-refund-${parsed.data.idempotencyKey}` },
    );
    const status =
      refund.status === "canceled" ? "cancelled" : (refund.status ?? "pending");
    await admin.from("refunds").upsert(
      {
        order_id: order.id,
        stripe_refund_id: refund.id,
        requested_by: user.id,
        amount_cents: remaining,
        status,
        reason: parsed.data.reason,
        restock_on_success: parsed.data.restock,
      },
      { onConflict: "stripe_refund_id" },
    );
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "order.cancellation_refund_requested",
      target_type: "order",
      target_id: order.id,
      safe_metadata: {
        amount_cents: remaining,
        restock_on_success: parsed.data.restock,
        stripe_refund_id: refund.id,
      },
    });
    if (parsed.data.notify) {
      await admin.from("email_outbox").insert({
        order_id: order.id,
        template: "refund_initiated",
        recipient: order.customer_email,
        payload: { order_id: order.id },
        dedupe_key: `refund_initiated:${refund.id}`,
      });
      await triggerEmailOutbox(order.id);
    }
    return NextResponse.json({ status: refund.status });
  } catch {
    return NextResponse.json(
      {
        error:
          "Stripe did not accept the refund. The order was not marked cancelled.",
      },
      { status: 502 },
    );
  }
}
