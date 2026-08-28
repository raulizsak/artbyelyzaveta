import type { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout-client";
import {
  getPaymentMode,
  getStripePublishableKey,
  isStripeCheckoutEnabled,
  isSupabaseConfigured,
} from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const paymentMode = getPaymentMode();
  const checkoutEnabled =
    paymentMode === "demo" ? true : isStripeCheckoutEnabled(paymentMode);
  const stripePublishableKey =
    paymentMode === "demo" ? "" : (getStripePublishableKey(paymentMode) ?? "");
  let initialDetails = {};
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return (
        <main className="checkout-page shell" id="main-content">
          <CheckoutClient
            checkoutEnabled={checkoutEnabled}
            paymentMode={paymentMode}
            stripePublishableKey={stripePublishableKey}
          />
        </main>
      );
    const [{ data: profile }, { data: address }] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("customer_addresses")
        .select("line1, suburb, state, postcode, country")
        .eq("is_default", true)
        .maybeSingle(),
    ]);
    initialDetails = {
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      email: user.email ?? "",
      phone: profile?.phone ?? "",
      address: address?.line1 ?? "",
      suburb: address?.suburb ?? "",
      state: address?.state ?? "VIC",
      postcode: address?.postcode ?? "",
      country: address?.country ?? "Australia",
    };
  }
  return (
    <main className="checkout-page shell" id="main-content">
      <CheckoutClient
        checkoutEnabled={checkoutEnabled}
        initialDetails={initialDetails}
        paymentMode={paymentMode}
        stripePublishableKey={stripePublishableKey}
      />
    </main>
  );
}
