import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.uuid(),
  restock: z.boolean().default(false),
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
    return NextResponse.json({ error: "Review the refund" }, { status: 400 });
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, customer_email, stripe_payment_intent_id, total_cents, amount_refunded_cents, payment_status, is_demo",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !["paid", "partially_refunded"].includes(order.payment_status))
    return NextResponse.json(
      { error: "Order is not refundable" },
      { status: 409 },
    );
  const remaining = order.total_cents - order.amount_refunded_cents;
  if (parsed.data.amountCents > remaining)
    return NextResponse.json(
      { error: "Refund exceeds the remaining payment" },
      { status: 400 },
    );
  if (order.is_demo) {
    const { error } = await admin.rpc("process_demo_refund", {
      p_order_id: order.id,
      p_amount_cents: parsed.data.amountCents,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_actor_user_id: user.id,
      p_cancel_order: false,
      p_restock: parsed.data.restock,
      p_notify: true,
    });
    if (error)
      return NextResponse.json(
        { error: "The demo refund could not be recorded." },
        { status: 409 },
      );
    await triggerEmailOutbox(order.id);
    return NextResponse.json({ status: "succeeded", demo: true });
  }
  if (!order.stripe_payment_intent_id)
    return NextResponse.json(
      { error: "Order is not refundable" },
      { status: 409 },
    );
  try {
    const refund = await getStripe().refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        amount: parsed.data.amountCents,
        reason: "requested_by_customer",
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `admin-refund-${parsed.data.idempotencyKey}` },
    );
    const status =
      refund.status === "canceled" ? "cancelled" : (refund.status ?? "pending");
    await admin.from("refunds").upsert(
      {
        order_id: order.id,
        stripe_refund_id: refund.id,
        requested_by: user.id,
        amount_cents: parsed.data.amountCents,
        status,
        reason: parsed.data.reason,
      },
      { onConflict: "stripe_refund_id" },
    );
    await admin.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "refund.requested",
      target_type: "order",
      target_id: order.id,
      safe_metadata: {
        amount_cents: parsed.data.amountCents,
        stripe_refund_id: refund.id,
      },
    });
    await admin.from("email_outbox").insert({
      order_id: order.id,
      template: "refund_initiated",
      recipient: order.customer_email,
      payload: { order_id: order.id },
      dedupe_key: `refund_initiated:${refund.id}`,
    });
    await triggerEmailOutbox(order.id);
    return NextResponse.json({ refundId: refund.id, status: refund.status });
  } catch {
    return NextResponse.json(
      { error: "Stripe did not accept the refund" },
      { status: 502 },
    );
  }
}
