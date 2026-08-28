import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteCommerce, QuoteError } from "@/lib/discounts/quote";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  paintingIds: z.array(z.uuid()).min(1).max(10),
  delivery: z.enum(["shipping", "collection"]),
  discountCodes: z.array(z.string().trim().min(1).max(40)).max(5),
  email: z.email().trim().max(320),
});

const messages: Record<string, string> = {
  painting_unavailable: "Sorry, one of these paintings is no longer available.",
  discount_invalid: "This discount code isn't valid.",
  discount_not_started: "This discount code isn't active yet.",
  discount_expired: "This discount code has expired.",
  discount_not_applicable: "This discount code doesn't apply to this painting.",
  discount_usage_limit: "This discount code has reached its usage limit.",
  discount_customer_limit: "This discount code has already been used for this email address.",
  discount_minimum_not_met: "This order doesn't meet the discount's minimum amount.",
  discount_not_combinable: "These discount codes can't be combined.",
};

export async function POST(request: Request) {
  if (
    !(await enforceRateLimit(request, {
      scope: "checkout-quote",
      limit: 60,
      windowMs: 60 * 60 * 1000,
    }))
  )
    return NextResponse.json({ error: "Please wait and try again." }, { status: 429 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Review your checkout details." }, { status: 400 });
  try {
    return NextResponse.json(await quoteCommerce(parsed.data));
  } catch (caught) {
    const code = caught instanceof QuoteError ? caught.code : "quote_unavailable";
    return NextResponse.json(
      { error: messages[code] ?? "The order total couldn't be refreshed." },
      { status: code === "painting_unavailable" ? 409 : 400 },
    );
  }
}
