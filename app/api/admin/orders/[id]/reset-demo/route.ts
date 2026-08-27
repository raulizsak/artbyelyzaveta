import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
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
  const { error } = await createAdminClient().rpc("reset_demo_order", {
    p_order_id: id,
    p_actor_user_id: user.id,
  });
  if (error)
    return NextResponse.json(
      { error: "Only demo orders can be reset." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true });
}
