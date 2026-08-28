import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/checkout";
import { triggerEmailOutbox } from "@/lib/email/outbox";
import { isDemoPaymentMode } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DemoOrder = {
  order_id: string;
  order_reference: string;
  guest_token: string | null;
};

export async function POST(request: Request) {
  if (!isDemoPaymentMode())
    return NextResponse.json(
      { error: "Demo checkout is not enabled." },
      { status: 503 },
    );
  try {
    if (
      !(await enforceRateLimit(request, {
        scope: "demo-checkout",
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
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    const normalizedEmail = input.email.trim().toLowerCase();
    const userId =
      user?.email_confirmed_at && user.email?.toLowerCase() === normalizedEmail
        ? user.id
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
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_demo_order", {
      p_painting_id: input.paintingIds[0],
      p_customer_user_id: userId as unknown as string,
      p_customer_email: normalizedEmail,
      p_customer_first_name: input.firstName,
      p_customer_last_name: input.lastName,
      p_customer_phone: input.phone,
      p_shipping_address: shippingAddress,
      p_delivery_method: input.delivery,
      p_delivery_notes: input.notes,
    });
    const order = (data as DemoOrder[] | null)?.[0];
    if (error || !order) {
      const unavailable =
        error?.code === "P0002" ||
        error?.message?.includes("no longer available");
      return NextResponse.json(
        {
          error: unavailable
            ? "Sorry, this painting is no longer available."
            : "We couldn't place the demo order. Please try again.",
        },
        { status: unavailable ? 409 : 503 },
      );
    }
    await triggerEmailOutbox(order.order_id);
    return NextResponse.json({
      reference: order.order_reference,
      guestToken: order.guest_token,
    });
  } catch {
    return NextResponse.json(
      { error: "The demo order could not be placed. No payment was taken." },
      { status: 503 },
    );
  }
}
