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
    .select("customer_email, customer_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!order)
    return NextResponse.json({ error: "Order unavailable" }, { status: 404 });
  const dedupe = randomUUID();
  let guestToken: string | undefined;
  if (!order.customer_user_id) {
    const { data: confirmation } = await admin
      .from("email_outbox")
      .select("payload")
      .eq("order_id", id)
      .eq("template", "order_confirmation")
      .maybeSingle();
    const payload = confirmation?.payload as Record<string, unknown> | null;
    if (typeof payload?.guest_token === "string")
      guestToken = payload.guest_token;
  }
  const { error } = await admin.from("email_outbox").insert({
    order_id: id,
    template: "invoice",
    recipient: order.customer_email,
    payload: {
      order_id: id,
      ...(guestToken ? { guest_token: guestToken } : {}),
    },
    dedupe_key: `invoice:${id}:${dedupe}`,
  });
  if (error)
    return NextResponse.json({ error: "Email not queued" }, { status: 503 });
  await triggerEmailOutbox(id);
  return NextResponse.json({ ok: true }, { status: 202 });
}
