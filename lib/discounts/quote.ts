import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export class QuoteError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export type CommerceQuote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  discounts: { code: string; appliedCents: number }[];
};

export async function quoteCommerce(input: {
  paintingIds: string[];
  delivery: "shipping" | "collection";
  discountCodes: string[];
  email: string;
}): Promise<CommerceQuote> {
  const admin = createAdminClient();
  const paintingIds = [...new Set(input.paintingIds)];
  const { data: paintings } = await admin
    .from("paintings")
    .select("id, price_cents, shipping_cents, currency, status, published_at")
    .in("id", paintingIds);
  if (
    !paintings ||
    paintings.length !== paintingIds.length ||
    paintings.some(
      (painting) =>
        painting.status !== "available" || painting.published_at === null,
    )
  )
    throw new QuoteError("painting_unavailable");
  if (new Set(paintings.map((painting) => painting.currency)).size !== 1)
    throw new QuoteError("mixed_currency_not_supported");

  const subtotalCents = paintings.reduce(
    (sum, painting) => sum + painting.price_cents,
    0,
  );
  // Collection is deliberately enforced as zero on the server.
  const shippingCents =
    input.delivery === "shipping"
      ? paintings.reduce((sum, painting) => sum + painting.shipping_cents, 0)
      : 0;
  const codes = [
    ...new Set(
      input.discountCodes
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  if (!codes.length)
    return {
      subtotalCents,
      discountCents: 0,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
      currency: paintings[0].currency,
      discounts: [],
    };

  const { data: discounts } = await admin
    .from("discounts")
    .select("*")
    .in("code", codes);
  if (!discounts || discounts.length !== codes.length)
    throw new QuoteError("discount_invalid");
  const now = Date.now();
  if (discounts.some((discount) => !discount.active || discount.archived_at))
    throw new QuoteError("discount_invalid");
  if (discounts.some((discount) => new Date(discount.starts_at).getTime() > now))
    throw new QuoteError("discount_not_started");
  if (
    discounts.some(
      (discount) =>
        discount.ends_at && new Date(discount.ends_at).getTime() <= now,
    )
  )
    throw new QuoteError("discount_expired");
  if (
    discounts.some(
      (discount) =>
        discount.minimum_subtotal_cents !== null &&
        subtotalCents < discount.minimum_subtotal_cents,
    )
  )
    throw new QuoteError("discount_minimum_not_met");
  if (discounts.length > 1 && discounts.some((discount) => !discount.combinable))
    throw new QuoteError("discount_not_combinable");

  const discountIds = discounts.map((discount) => discount.id);
  const [{ data: eligibleRows }, { data: redemptions }] = await Promise.all([
    admin
      .from("discount_products")
      .select("discount_id, painting_id")
      .in("discount_id", discountIds)
      .in("painting_id", paintingIds),
    admin
      .from("discount_redemptions")
      .select("discount_id, normalized_email, status")
      .in("discount_id", discountIds)
      .in("status", ["reserved", "confirmed"]),
  ]);

  const normalizedEmail = input.email.trim().toLowerCase();
  for (const discount of discounts) {
    const uses = redemptions?.filter(
      (redemption) => redemption.discount_id === discount.id,
    );
    if (discount.max_redemptions !== null && (uses?.length ?? 0) >= discount.max_redemptions)
      throw new QuoteError("discount_usage_limit");
    if (
      discount.one_use_per_customer &&
      uses?.some((redemption) => redemption.normalized_email === normalizedEmail)
    )
      throw new QuoteError("discount_customer_limit");
    if (
      discount.applies_to === "specific" &&
      !eligibleRows?.some((row) => row.discount_id === discount.id)
    )
      throw new QuoteError("discount_not_applicable");
  }

  let remaining = subtotalCents;
  const applied: { code: string; appliedCents: number }[] = [];
  for (const discount of [...discounts].sort((left, right) => {
    const typeOrder =
      Number(left.discount_type === "fixed_amount") -
      Number(right.discount_type === "fixed_amount");
    return typeOrder || left.code.localeCompare(right.code);
  })) {
    const eligibleIds = new Set(
      eligibleRows
        ?.filter((row) => row.discount_id === discount.id)
        .map((row) => row.painting_id) ?? [],
    );
    const eligibleSubtotal =
      discount.applies_to === "all"
        ? subtotalCents
        : paintings
            .filter((painting) => eligibleIds.has(painting.id))
            .reduce((sum, painting) => sum + painting.price_cents, 0);
    const configured =
      discount.discount_type === "percentage"
        ? Math.floor(eligibleSubtotal * (Number(discount.percent_off) / 100))
        : Math.min(eligibleSubtotal, discount.amount_off_cents ?? 0);
    const appliedCents = Math.max(0, Math.min(remaining, configured));
    remaining -= appliedCents;
    applied.push({ code: discount.code, appliedCents });
  }
  const discountCents = applied.reduce(
    (sum, discount) => sum + discount.appliedCents,
    0,
  );
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: subtotalCents - discountCents + shippingCents,
    currency: paintings[0].currency,
    discounts: applied,
  };
}
