import { notFound } from "next/navigation";
import { DiscountEditor } from "@/components/discount-editor";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { toMelbourneDateTimeLocal } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  await requireAdminAal2(`/admin/discounts/${encodeURIComponent(id)}`);
  const admin = createAdminClient();
  const [{ data: discount }, { data: paintings }, { data: eligible }] = await Promise.all([
    admin.from("discounts").select("*").eq("id", id).maybeSingle(),
    admin.from("paintings").select("id, title, status").order("title"),
    admin.from("discount_products").select("painting_id").eq("discount_id", id),
  ]);
  if (!discount) notFound();
  return <DiscountEditor initial={{
    active: discount.active,
    amountOffAud: discount.amount_off_cents === null ? "" : (discount.amount_off_cents / 100).toFixed(2),
    appliesTo: discount.applies_to as "all" | "specific",
    code: discount.code,
    combinable: discount.combinable,
    discountType: discount.discount_type as "percentage" | "fixed_amount",
    endsAt: discount.ends_at ? toMelbourneDateTimeLocal(discount.ends_at) : "",
    id: discount.id,
    maxRedemptions: discount.max_redemptions?.toString() ?? "",
    minimumSubtotalAud: discount.minimum_subtotal_cents === null ? "" : (discount.minimum_subtotal_cents / 100).toFixed(2),
    oneUsePerCustomer: discount.one_use_per_customer,
    paintingIds: (eligible ?? []).map((item) => item.painting_id),
    percentOff: discount.percent_off?.toString() ?? "",
    startsAt: toMelbourneDateTimeLocal(discount.starts_at),
  }} paintings={paintings ?? []} />;
}
