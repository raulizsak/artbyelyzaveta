import "server-only";

import Stripe from "stripe";
import {
  getPaymentMode,
  getStripeSecretKey,
  isLiveCheckoutEnabled,
  isTestCheckoutEnabled,
  type StripeMode,
} from "@/lib/env";

const stripeClients = new Map<StripeMode, Stripe>();

export function getStripe(
  requestedMode?: StripeMode,
  requireCheckoutEnabled = true,
) {
  const configuredMode = requestedMode ?? getPaymentMode();
  if (configuredMode === "demo") throw new Error("Stripe is not active.");
  const mode: StripeMode = configuredMode;
  const key = getStripeSecretKey(mode);
  if (!key || !key.startsWith(mode === "live" ? "sk_live_" : "sk_test_"))
    throw new Error(`Stripe ${mode} mode is not configured.`);
  if (
    requireCheckoutEnabled &&
    ((mode === "live" && !isLiveCheckoutEnabled()) ||
      (mode === "test" && !isTestCheckoutEnabled()))
  )
    throw new Error(`Stripe ${mode} checkout is not enabled.`);

  const existing = stripeClients.get(mode);
  if (existing) return existing;
  const client = new Stripe(key, {
    appInfo: { name: "Art by Elyzaveta", version: "0.1.0" },
  });
  stripeClients.set(mode, client);
  return client;
}

export function getCheckoutStripe() {
  const mode = getPaymentMode();
  if (mode === "demo") throw new Error("Stripe checkout is not active.");
  return { mode, stripe: getStripe(mode) };
}
