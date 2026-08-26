import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAccountIdentity();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const id = (await params).id;
  const admin = createAdminClient();
  const { data: method } = await admin
    .from("payment_methods")
    .select("stripe_payment_method_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!method)
    return NextResponse.json(
      { error: "Payment method unavailable" },
      { status: 404 },
    );
  try {
    await getStripe().paymentMethods.detach(method.stripe_payment_method_id);
    await admin
      .from("payment_methods")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Payment method could not be removed" },
      { status: 502 },
    );
  }
}
