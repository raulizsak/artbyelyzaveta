import "server-only";

import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ConfirmationOrder = {
  reference: string;
  firstName: string;
  email: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  deliveryMethod: string;
  isDemo: boolean;
  item: { title: string; paintingSlug: string } | null;
};

export async function getOrderForConfirmation({
  reference,
  token,
}: {
  reference: string;
  token?: string;
}): Promise<ConfirmationOrder | null> {
  if (!/^ABE-[0-9]{4}-[A-F0-9]{10}$/.test(reference)) return null;
  const admin = createAdminClient();
  let orderId: string | null = null;

  if (token && /^[a-f0-9]{64}$/i.test(token)) {
    const result = await admin.rpc("lookup_guest_order", { p_token: token });
    orderId = result.data ?? null;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const result = await admin
      .from("orders")
      .select("id")
      .eq("order_reference", reference)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    orderId = result.data?.id ?? null;
  }
  if (!orderId) return null;

  const { data, error } = await admin
    .from("orders")
    .select(
      "order_reference, customer_first_name, customer_email, payment_status, fulfillment_status, total_cents, currency, delivery_method, is_demo, order_items(title, painting_slug)",
    )
    .eq("id", orderId)
    .eq("order_reference", reference)
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
    isDemo: data.is_demo,
    item: items[0]
      ? { title: items[0].title, paintingSlug: items[0].painting_slug }
      : null,
  };
}

export async function getOrderForStripeSession(
  sessionId: string,
): Promise<ConfirmationOrder | null> {
  if (!/^cs_(?:test|live)_[A-Za-z0-9]{16,250}$/.test(sessionId)) return null;
  const mode = sessionId.startsWith("cs_live_") ? "live" : "test";
  try {
    const session = await getStripe(mode, false).checkout.sessions.retrieve(
      sessionId,
    );
    const orderId = session.metadata?.order_id;
    if (!orderId || session.livemode !== (mode === "live")) return null;
    const { data, error } = await createAdminClient()
      .from("orders")
      .select(
        "order_reference, customer_first_name, customer_email, payment_status, fulfillment_status, total_cents, currency, delivery_method, is_demo, order_items(title, painting_slug)",
      )
      .eq("id", orderId)
      .eq("stripe_checkout_session_id", session.id)
      .eq("stripe_mode", mode)
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
      isDemo: data.is_demo,
      item: items[0]
        ? { title: items[0].title, paintingSlug: items[0].painting_slug }
        : null,
    };
  } catch {
    return null;
  }
}
