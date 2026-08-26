import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum([
    "requested",
    "needs_information",
    "approved",
    "declined",
    "awaiting_return",
    "received",
    "refunded",
    "closed",
  ]),
  response: z.string().trim().max(5000),
  approvedRefundCents: z.number().int().min(0).nullable(),
  notify: z.boolean(),
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
  const { error } = await (
    await createClient()
  ).rpc("admin_update_return", {
    p_return_id: id,
    p_status: parsed.data.status,
    p_response: parsed.data.response,
    p_approved_refund_cents: parsed.data.approvedRefundCents,
    p_notify: parsed.data.notify,
  });
  if (error)
    return NextResponse.json({ error: "Return not updated" }, { status: 503 });
  if (parsed.data.notify) {
    const { data: returnRecord } = await (await createClient())
      .from("return_requests")
      .select("order_id")
      .eq("id", id)
      .single();
    if (returnRecord?.order_id) await triggerEmailOutbox(returnRecord.order_id);
  }
  return NextResponse.json({ ok: true });
}
