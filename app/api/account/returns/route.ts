import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  orderId: z.uuid(),
  reason: z.string().trim().min(1).max(200),
  explanation: z.string().trim().min(10).max(5000),
  requestedRefundCents: z.number().int().min(0),
});
export async function POST(request: Request) {
  const user = await getAccountIdentity();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (
    !(await enforceRateLimit(request, {
      scope: "return",
      limit: 5,
      windowMs: 60 * 60 * 1000,
    }))
  )
    return NextResponse.json(
      { error: "Please wait before trying again" },
      { status: 429 },
    );
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Review the request" }, { status: 400 });
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, total_cents, payment_status")
    .eq("id", parsed.data.orderId)
    .eq("customer_user_id", user.id)
    .maybeSingle();
  if (!order || order.payment_status !== "paid")
    return NextResponse.json({ error: "Order unavailable" }, { status: 404 });
  const requested = Math.min(
    parsed.data.requestedRefundCents,
    order.total_cents,
  );
  const { data: created, error } = await admin
    .from("return_requests")
    .insert({
      order_id: order.id,
      user_id: user.id,
      reason: parsed.data.reason,
      explanation: parsed.data.explanation,
      requested_refund_cents: requested,
    })
    .select("id")
    .single();
  if (error || !created)
    return NextResponse.json({ error: "Request not saved" }, { status: 409 });
  await admin.from("order_events").insert({
    order_id: order.id,
    event_type: "return_requested",
    actor_user_id: user.id,
    actor_type: "customer",
    customer_safe_description: "Return requested.",
  });
  await admin.from("email_outbox").insert([
    {
      order_id: order.id,
      template: "return_requested",
      recipient: user.email,
      payload: { order_id: order.id, return_id: created.id },
      dedupe_key: `return_requested:${created.id}`,
    },
    {
      order_id: order.id,
      template: "admin_return_requested",
      recipient: "ADMIN_EMAIL",
      payload: { order_id: order.id, return_id: created.id },
      dedupe_key: `admin_return_requested:${created.id}`,
    },
  ]);
  await triggerEmailOutbox(order.id);
  return NextResponse.json({ id: created.id }, { status: 201 });
}
