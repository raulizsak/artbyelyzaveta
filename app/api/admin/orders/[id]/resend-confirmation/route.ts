import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("customer_email")
    .eq("id", id)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order unavailable" }, { status: 404 });

  const { error } = await admin.from("email_outbox").insert({
    order_id: id,
    template: "order_confirmation",
    recipient: order.customer_email,
    payload: { order_id: id },
    dedupe_key: `order_confirmation_resend:${id}:${randomUUID()}`,
  });
  if (error)
    return NextResponse.json({ error: "Email not queued" }, { status: 503 });
  await admin.from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "order.confirmation_resent",
    target_type: "order",
    target_id: id,
    safe_metadata: {},
  });
  await triggerEmailOutbox(id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
