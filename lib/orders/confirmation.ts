import "server-only";

import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ConfirmationOrder = {
  reference: string;
  firstName: string;
  email: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  deliveryMethod: string;
  item: { title: string; paintingSlug: string } | null;
};

export async function getOrderForStripeSession(
  sessionId: string,
): Promise<ConfirmationOrder | null> {
  if (!sessionId.startsWith("cs_test_")) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id;
    if (!orderId) return null;
    const { data, error } = await createAdminClient()
      .from("orders")
      .select(
        "order_reference, customer_first_name, customer_email, payment_status, fulfillment_status, total_cents, currency, delivery_method, stripe_checkout_session_id, order_items(title, painting_slug)",
      )
      .eq("id", orderId)
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (error || !data) return null;
    const items = data.order_items as unknown as {
      title: string;
      painting_slug: string;
    }[];
    return {
      reference: data.order_reference,
      firstName: data.customer_first_name,
      email: data.customer_email,
      paymentStatus: data.payment_status,
      fulfillmentStatus: data.fulfillment_status,
      totalCents: data.total_cents,
      currency: data.currency,
      deliveryMethod: data.delivery_method,
      item: items[0]
        ? { title: items[0].title, paintingSlug: items[0].painting_slug }
        : null,
    };
  } catch {
    return null;
  }
}
