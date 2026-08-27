import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { getStripe } from "@/lib/stripe/server";
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
      "id, customer_email, payment_status, fulfillment_status, total_cents, amount_refunded_cents, stripe_payment_intent_id, order_items(painting_id)",
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
  if (!order.stripe_payment_intent_id || remaining <= 0)
    return NextResponse.json(
      { error: "No refundable payment remains." },
      { status: 409 },
    );

  try {
    const refund = await getStripe().refunds.create(
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
