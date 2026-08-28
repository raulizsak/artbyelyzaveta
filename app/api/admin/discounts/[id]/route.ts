import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountIdentity } from "@/lib/auth/authorization";
import { discountInputSchema } from "@/lib/discounts/admin";
import { syncDiscountCatalog } from "@/lib/stripe/discounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getAdmin() {
  const user = await getAccountIdentity();
  return user?.profile.role === "admin" && user.aal === "aal2" ? user : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdmin();
  if (!user)
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  const parsed = discountInputSchema.safeParse(await request.json());
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: parsed.error?.issues[0]?.message || "Review the discount details." },
      { status: 400 },
    );
  const value = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_discount", {
    p_discount_id: id,
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
            : error?.code === "P0002"
              ? "Discount not found."
              : "Discount could not be saved.",
      },
      { status: error?.code === "23505" ? 409 : error?.code === "P0002" ? 404 : 503 },
    );
  await createAdminClient().from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "discount.updated",
    target_type: "discount",
    target_id: id,
    safe_metadata: { code: value.code, version: result.version ?? 1 },
  });
  const stripeSync = await syncDiscountCatalog(id);
  return NextResponse.json({ id, stripeSync });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAdmin();
  if (!user)
    return NextResponse.json(
      { error: "AAL2 administrator access required" },
      { status: 403 },
    );
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid discount" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_archive_discount", {
    p_discount_id: id,
  });
  if (error)
    return NextResponse.json(
      { error: error.code === "P0002" ? "Discount not found." : "Discount could not be archived." },
      { status: error.code === "P0002" ? 404 : 503 },
    );
  await createAdminClient().from("admin_audit_log").insert({
    actor_user_id: user.id,
    action: "discount.archived",
    target_type: "discount",
    target_id: id,
    safe_metadata: {},
  });
  const stripeSync = await syncDiscountCatalog(id);
  return NextResponse.json({ ok: true, stripeSync });
}
