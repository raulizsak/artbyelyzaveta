import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(50),
});
export async function PATCH(request: Request) {
  const user = await getAccountIdentity();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Review your details" }, { status: 400 });
  const { error } = await (
    await createClient()
  ).rpc("update_my_profile", {
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone,
  });
  return error
    ? NextResponse.json({ error: "Profile not saved" }, { status: 503 })
    : NextResponse.json({ ok: true });
}
