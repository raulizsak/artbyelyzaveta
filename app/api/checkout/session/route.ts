import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/checkout";
import { isTestCheckoutEnabled } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Reservation = {
  order_id: string;
  guest_token: string;
  total_cents: number;
  currency: string;
};

export async function POST(request: Request) {
  if (!isTestCheckoutEnabled())
    return NextResponse.json(
      { error: "Stripe TEST MODE checkout is not enabled." },
      { status: 503 },
    );
  let orderId: string | null = null;
  try {
    const admin = createAdminClient();
    if (
      !(await enforceRateLimit(request, {
        scope: "checkout",
        limit: 8,
        windowMs: 60 * 60 * 1000,
      }))
    ) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please wait and try again." },
        { status: 429 },
      );
    }
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please review your contact and delivery details." },
        { status: 400 },
      );
    const input = parsed.data;
    const sessionClient = await createClient();
    const claimsResult = await sessionClient.auth.getClaims();
    const claims = claimsResult.data?.claims as
      | Record<string, unknown>
      | undefined;
    const claimEmail =
      typeof claims?.email === "string" ? claims.email.toLowerCase() : "";
    const userId =
      claimEmail === input.email && typeof claims?.sub === "string"
        ? claims.sub
        : null;
    const shippingAddress =
      input.delivery === "shipping"
        ? {
            recipient_name: `${input.firstName} ${input.lastName}`,
            line1: input.address,
            suburb: input.suburb,
            state: input.state,
            postcode: input.postcode,
            country: input.country,
          }
        : {};
    const { data, error } = await admin.rpc("create_checkout_reservation", {
      p_painting_id: input.paintingId,
      p_customer_user_id: userId,
      p_customer_email: input.email,
      p_customer_first_name: input.firstName,
      p_customer_last_name: input.lastName,
      p_customer_phone: input.phone,
      p_shipping_address: shippingAddress,
      p_delivery_method: input.delivery,
      p_delivery_notes: input.notes,
      p_shipping_cents: 0,
      p_reservation_minutes: 30,
    });
    const reservation = (data as Reservation[] | null)?.[0];
    if (error || !reservation) {
      const unavailable =
        error?.code === "P0002" ||
        error?.message?.includes("no longer available");
      return NextResponse.json(
        {
          error: unavailable
            ? "Sorry, this painting is no longer available."
            : "We couldn't reserve the painting. Please try again.",
        },
        { status: unavailable ? 409 : 503 },
      );
    }
    orderId = reservation.order_id;
    const { data: item } = await admin
      .from("order_items")
      .select("title")
      .eq("order_id", orderId)
      .single();
    const siteUrl = process.env.SITE_URL?.trim() || new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: "custom",
        mode: "payment",
        customer_email: input.email,
        return_url: `${siteUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: reservation.currency.toLowerCase(),
              unit_amount: reservation.total_cents,
              product_data: { name: item?.title || "Original painting" },
            },
          },
        ],
        metadata: { order_id: orderId },
        payment_intent_data: { metadata: { order_id: orderId } },
      },
      { idempotencyKey: `checkout-${orderId}` },
    );
    if (!session.client_secret) throw new Error("missing-client-secret");
    const { error: attachError } = await admin.rpc(
      "attach_stripe_checkout_session",
      {
        p_order_id: orderId,
        p_session_id: session.id,
        p_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        p_stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
      },
    );
    if (attachError) throw attachError;
    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch {
    if (orderId)
      await createAdminClient().rpc("release_checkout_reservation", {
        p_order_id: orderId,
        p_reason: "Stripe session creation failed",
      });
    return NextResponse.json(
      { error: "Secure payment could not be prepared. No payment was taken." },
      { status: 503 },
    );
  }
}
