import "server-only";

import { getStripe } from "@/lib/stripe/server";

type StripeOrder = {
  id: string;
  stripe_mode: string | null;
  stripe_checkout_session_id?: string | null;
};

export function getOrderStripe(order: StripeOrder) {
  if (order.stripe_mode !== "test" && order.stripe_mode !== "live") {
    throw new Error("The order has no verified Stripe mode.");
  }
  // Existing orders must remain manageable after checkout changes mode or closes.
  return getStripe(order.stripe_mode, false);
}

/** Close Stripe first; only then may the caller release the artwork in the database. */
export async function expireUnpaidOrderSession(order: StripeOrder) {
  // A missing ID may mean session creation is still in progress; do not restock.
  if (!order.stripe_checkout_session_id) {
    throw new Error("The order has no verified Stripe checkout session.");
  }
  const stripe = getOrderStripe(order);
  const sessionId = order.stripe_checkout_session_id;
  const matchesOrder = (session: {
    livemode: boolean;
    metadata: Record<string, string> | null;
  }) =>
    session.livemode === (order.stripe_mode === "live") &&
    session.metadata?.order_id === order.id;
  let session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!matchesOrder(session))
    throw new Error("Stripe session does not match the order.");
  if (session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Expiry may race a webhook, another cancellation, or a customer's payment.
      // Read back the authoritative result; an API error alone never permits restock.
      session = await stripe.checkout.sessions.retrieve(sessionId);
    }
  }
  if (
    !matchesOrder(session) ||
    session.status !== "expired" ||
    session.payment_status !== "unpaid"
  ) {
    throw new Error(
      "Payment is complete or unresolved. Refresh the order before cancelling.",
    );
  }
}
