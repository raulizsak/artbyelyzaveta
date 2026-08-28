import { NextResponse } from "next/server";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { discountInputSchema } from "@/lib/discounts/admin";
import { syncDiscountCatalog } from "@/lib/stripe/discounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getAccountIdentity();
  if (user?.profile.role !== "admin" || user.aal !== "aal2")
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const parsed = discountInputSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Review the discount details." },
      { status: 400 },
    );
  const value = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_discount", {
    p_discount_id: null,
    p_code: value.code,
    p_discount_type: value.discountType,
    p_percent_off: value.discountType === "percentage" ? value.percentOff : null,
    p_amount_off_cents:
      value.discountType === "fixed_amount" ? value.amountOffAud : null,
    p_applies_to: value.appliesTo,
    p_painting_ids: value.appliesTo === "specific" ? value.paintingIds : [],
    p_starts_at: value.startsAt,
    p_ends_at: value.endsAt,
    p_max_redemptions: value.maxRedemptions,
    p_one_use_per_customer: value.oneUsePerCustomer,
    p_minimum_subtotal_cents: value.minimumSubtotalAud,
    p_combinable: value.combinable,
    p_active: value.active,
  });
  const result = data as { id?: string; version?: number } | null;
  if (error || !result?.id)
    return NextResponse.json(
      {
        error:
          error?.code === "23505"
            ? "That discount code is already in use."
            : "Discount could not be saved.",
      },
      { status: error?.code === "23505" ? 409 : 503 },
    );

  await createAdminClient().from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "discount.created",
    target_type: "discount",
    target_id: result.id,
    safe_metadata: { code: value.code, version: result.version ?? 1 },
  });
  const stripeSync = await syncDiscountCatalog(result.id);
  return NextResponse.json({ id: result.id, stripeSync }, { status: 201 });
}
