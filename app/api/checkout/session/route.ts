import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { checkoutSchema } from "@/lib/checkout";
import { getPaymentMode, isStripeCheckoutEnabled } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCheckoutPriceIds } from "@/lib/stripe/catalog";
import { getCheckoutStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Reservation = {
  order_id: string;
  order_reference: string;
  guest_token: string;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  items: Array<{ painting_id: string }>;
  discounts: Array<{ code: string; applied_cents: number }>;
};

const discountErrors: Record<string, string> = {
  discount_invalid: "This discount code isn't valid.",
  discount_not_started: "This discount code isn't active yet.",
  discount_expired: "This discount code has expired.",
  discount_not_applicable: "This discount code doesn't apply to this painting.",
  discount_usage_limit: "This discount code has reached its usage limit.",
  discount_customer_limit:
    "This discount code has already been used for this email address.",
  discount_minimum_not_met:
    "This order doesn't meet the discount's minimum amount.",
  discount_not_combinable: "These discount codes can't be combined.",
};

const stripeCountryCode = (country: string) => {
  const value = country.trim();
  if (/^[a-z]{2}$/i.test(value)) return value.toUpperCase();
  return (
    {
      australia: "AU",
      "new zealand": "NZ",
      "united kingdom": "GB",
      "united states": "US",
      canada: "CA",
      ireland: "IE",
    } as Record<string, string>
  )[value.toLowerCase()];
};

export async function POST(request: Request) {
  const paymentMode = getPaymentMode();
  if (paymentMode === "demo" || !isStripeCheckoutEnabled(paymentMode))
    return NextResponse.json(
      { error: "Secure checkout is temporarily unavailable." },
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
    )
      return NextResponse.json(
        { error: "Too many checkout attempts. Please wait and try again." },
        { status: 429 },
      );

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

    const { data, error } = await admin.rpc("create_commerce_checkout", {
      p_painting_ids: input.paintingIds,
      p_customer_user_id: userId as unknown as string,
      p_customer_email: input.email,
      p_customer_first_name: input.firstName,
      p_customer_last_name: input.lastName,
      p_customer_phone: input.phone,
      p_shipping_address: shippingAddress,
      p_delivery_method: input.delivery,
      p_delivery_notes: input.notes,
      p_discount_codes: input.discountCodes,
      p_reservation_minutes: 30,
    });
    const reservation = (data as Reservation[] | null)?.[0];
    if (error || !reservation) {
      const errorKey = Object.keys(discountErrors).find((key) =>
        error?.message?.includes(key),
      );
      const unavailable =
        error?.code === "P0002" ||
        error?.message?.includes("painting_unavailable");
      return NextResponse.json(
        {
          error: errorKey
            ? discountErrors[errorKey]
            : unavailable
              ? "Sorry, one of these paintings is no longer available."
              : "We couldn't reserve the artwork. Please try again.",
        },
        { status: unavailable ? 409 : errorKey ? 400 : 503 },
      );
    }
    orderId = reservation.order_id;

    const { mode, stripe } = getCheckoutStripe();
    const prices = await getCheckoutPriceIds(input.paintingIds, mode);
    let executionCoupon: Stripe.Coupon | null = null;
    if (reservation.discount_cents > 0) {
      executionCoupon = await stripe.coupons.create(
        {
          duration: "once",
          amount_off: reservation.discount_cents,
          currency: reservation.currency.toLowerCase(),
          name: reservation.discounts
            .map((discount) => discount.code)
            .join(" + "),
          metadata: {
            order_id: orderId,
            discount_codes: reservation.discounts
              .map((discount) => discount.code)
              .join(","),
          },
        },
        { idempotencyKey: `checkout-discount-${orderId}` },
      );
      await admin
        .from("order_discounts")
        .update({ stripe_coupon_id: executionCoupon.id })
        .eq("order_id", orderId);
    }

    const siteUrl = process.env.SITE_URL?.trim() || new URL(request.url).origin;
    const stripeCustomer = await stripe.customers.create(
      {
        email: input.email,
        name: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone || undefined,
        address:
          input.delivery === "shipping"
            ? {
                line1: input.address,
                city: input.suburb,
                state: input.state,
                postal_code: input.postcode,
                country: stripeCountryCode(input.country),
              }
            : undefined,
        metadata: {
          order_id: orderId,
          order_reference: reservation.order_reference,
          stripe_mode: mode,
        },
      },
      { idempotencyKey: `checkout-customer-${mode}-${orderId}` },
    );
    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: "custom",
        mode: "payment",
        customer: stripeCustomer.id,
        return_url: `${siteUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: prices.map((entry) => ({
          quantity: 1,
          price: entry.priceId,
        })),
        discounts: executionCoupon
          ? [{ coupon: executionCoupon.id }]
          : undefined,
        shipping_options:
          reservation.shipping_cents > 0
            ? [
                {
                  shipping_rate_data: {
                    type: "fixed_amount",
                    display_name: "Insured artwork shipping",
                    fixed_amount: {
                      amount: reservation.shipping_cents,
                      currency: reservation.currency.toLowerCase(),
                    },
                    metadata: { order_id: orderId },
                  },
                },
              ]
            : undefined,
        metadata: { order_id: orderId, stripe_mode: mode },
        payment_intent_data: {
          metadata: { order_id: orderId, stripe_mode: mode },
        },
      },
      { idempotencyKey: `checkout-${orderId}` },
    );
    if (!session.client_secret) throw new Error("missing-client-secret");
    const { error: attachError } = await admin.rpc(
      "attach_commerce_checkout_session",
      {
        p_order_id: orderId,
        p_session_id: session.id,
        p_mode: mode,
        p_discount_coupon_id: executionCoupon?.id as unknown as string,
        p_payment_intent_id: (typeof session.payment_intent === "string"
          ? session.payment_intent
          : null) as unknown as string,
        p_stripe_customer_id: stripeCustomer.id,
      },
    );
    if (attachError) throw attachError;

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      orderReference: reservation.order_reference,
      subtotalCents: reservation.subtotal_cents,
      discountCents: reservation.discount_cents,
      shippingCents: reservation.shipping_cents,
      totalCents: reservation.total_cents,
      discounts: reservation.discounts,
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
