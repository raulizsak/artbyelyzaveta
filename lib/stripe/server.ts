import "server-only";

import Stripe from "stripe";
import { isLiveCheckoutEnabled, isTestCheckoutEnabled } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe is not configured.");
  if (key.startsWith("sk_live_") && !isLiveCheckoutEnabled()) {
    throw new Error(
      "Live Stripe keys are blocked until live checkout is explicitly approved.",
    );
  }
  if (!key.startsWith("sk_test_") || !isTestCheckoutEnabled()) {
    throw new Error("Stripe TEST MODE checkout is not enabled.");
  }
  stripeClient ??= new Stripe(key, {
    appInfo: { name: "Art by Elyzaveta", version: "0.1.0" },
  });
  return stripeClient;
}
