import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getAccountIdentity();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const stripe = getStripe();
    let customerId = user.profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: `customer-${user.id}` },
      );
      customerId = customer.id;
      await createAdminClient()
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }
    const setup = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { user_id: user.id },
    });
    if (!setup.client_secret) throw new Error("missing-client-secret");
    return NextResponse.json({ clientSecret: setup.client_secret });
  } catch {
    return NextResponse.json(
      { error: "Secure card setup is unavailable" },
      { status: 503 },
    );
  }
}
