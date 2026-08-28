import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["fulfill", "update", "delay", "cancel", "commission_update"]),
  notify: z.boolean(),
  fulfillmentStatus: z.enum([
    "unfulfilled",
    "preparing",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
  ]),
  orderStatus: z.enum([
    "pending",
    "confirmed",
    "delayed",
    "cancelled",
    "refunded",
    "completed",
  ]),
  trackingCarrier: z.string().trim().max(100),
  trackingNumber: z.string().trim().max(200),
  trackingUrl: z.union([z.literal(""), z.url().max(1000)]),
  commissionEta: z.union([z.literal(""), z.iso.date()]),
  customerMessage: z.string().trim().max(3000),
  internalNotes: z.string().trim().max(5000),
  commissionStage: z.enum([
    "enquiry",
    "accepted",
    "deposit_paid",
    "in_progress",
    "review",
    "complete",
    "dispatched",
  ]),
  expectedDispatch: z.union([z.literal(""), z.iso.date()]),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = schema.safeParse(await request.json());
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json({ error: "Review the update" }, { status: 400 });
  const value = parsed.data;
  const supabase = await createClient();
  const detectedCarrier =
    value.trackingCarrier ||
    (/auspost\.com\.au/i.test(value.trackingUrl) || /AU$/i.test(value.trackingNumber)
      ? "Australia Post"
      : "");
  if (value.fulfillmentStatus === "delivered" && value.action !== "commission_update") {
    const { error: detailError } = await supabase.rpc("admin_update_order", {
      p_order_id: id,
      p_action: "update",
      p_notify: false,
      p_changes: {
        order_status: value.orderStatus,
        tracking_carrier: detectedCarrier,
        tracking_number: value.trackingNumber,
        tracking_url: value.trackingUrl,
        customer_status_message: value.customerMessage,
        internal_admin_notes: value.internalNotes,
      },
    });
    const { error: deliveredError } = detailError
      ? { error: detailError }
      : await supabase.rpc("admin_mark_order_delivered", {
          p_order_id: id,
          p_tracking_status: "Delivered",
          p_latest_event: {
            description: "Marked as delivered by the studio.",
            date: new Date().toISOString(),
          },
        });
    if (deliveredError)
      return NextResponse.json({ error: "Order not updated" }, { status: 503 });
    await triggerEmailOutbox(id);
    return NextResponse.json({ ok: true });
  }
  const { error } =
    value.action === "commission_update"
      ? await supabase.rpc("admin_update_commission", {
          p_order_id: id,
          p_stage: value.commissionStage,
          // PostgreSQL function arguments are nullable, but generated
          // PostgREST types cannot represent argument nullability.
          p_eta: (value.commissionEta || null) as unknown as string,
          p_expected_dispatch: (value.expectedDispatch ||
            null) as unknown as string,
          p_customer_message: value.customerMessage,
          p_internal_notes: value.internalNotes,
          p_notify: value.notify,
        })
      : await supabase.rpc("admin_update_order", {
          p_order_id: id,
          p_action: value.action,
          p_notify: value.notify,
          p_changes: {
            fulfillment_status: value.fulfillmentStatus,
            order_status: value.orderStatus,
            tracking_carrier: detectedCarrier,
            tracking_number: value.trackingNumber,
            tracking_url: value.trackingUrl,
            commission_eta: value.commissionEta,
            customer_status_message: value.customerMessage,
            internal_admin_notes: value.internalNotes,
          },
        });
  if (error)
    return NextResponse.json({ error: "Order not updated" }, { status: 503 });
  if (value.notify) await triggerEmailOutbox(id);
  return NextResponse.json({ ok: true });
}
