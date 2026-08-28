import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMoney } from "@/lib/catalog";
import { formatMelbourneDate } from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

function discountStatus(discount: {
  active: boolean;
  archived_at: string | null;
  ends_at: string | null;
  starts_at: string;
}) {
  const now = Date.now();
  if (discount.archived_at) return "archived";
  if (!discount.active) return "inactive";
  if (new Date(discount.starts_at).getTime() > now) return "scheduled";
  if (discount.ends_at && new Date(discount.ends_at).getTime() <= now) return "expired";
  return "active";
}

export default async function Page() {
  await requireAdminAal2("/admin/discounts");
  const admin = createAdminClient();
  const [{ data: discounts }, { data: redemptions }] = await Promise.all([
    admin
      .from("discounts")
      .select("*, discount_products(painting_id), discount_stripe_catalog(mode, version, sync_status)")
      .order("created_at", { ascending: false }),
    admin.from("discount_redemptions").select("discount_id, status"),
  ]);
  const uses = new Map<string, number>();
  for (const redemption of redemptions ?? [])
    if (redemption.status === "confirmed")
      uses.set(redemption.discount_id, (uses.get(redemption.discount_id) ?? 0) + 1);

  return (
    <section className="account-panel">
      <div className="section-heading">
        <div><p className="eyebrow">Promotions</p><h1>Discounts</h1></div>
        <Link className="primary-action" href="/admin/discounts/new">Create discount</Link>
      </div>
      <div className="admin-order-table discount-table">
        <div className="admin-order-table__head"><span>Code</span><span>Discount</span><span>Applies to</span><span>Status</span><span>Uses</span><span>Dates</span></div>
        {discounts?.map((discount) => {
          const syncRows = discount.discount_stripe_catalog.filter(
            (row) => row.version === discount.version,
          );
          const syncProblem = syncRows.some((row) => row.sync_status === "error");
          return <Link className="admin-order-row" href={`/admin/discounts/${discount.id}`} key={discount.id}><span><strong>{discount.code}</strong><small>Version {discount.version}{syncProblem ? " · Stripe sync needs attention" : ""}</small></span><strong>{discount.discount_type === "percentage" ? `${Number(discount.percent_off)}% off` : `${formatMoney(discount.amount_off_cents ?? 0)} off`}</strong><span>{discount.applies_to === "all" ? "All paintings" : `${discount.discount_products.length} selected`}</span><span>{formatDisplayValue(discountStatus(discount))}</span><span>{uses.get(discount.id) ?? 0}{discount.max_redemptions ? ` / ${discount.max_redemptions}` : " / Unlimited"}</span><small>{formatMelbourneDate(discount.starts_at)}{discount.ends_at ? ` – ${formatMelbourneDate(discount.ends_at)}` : " – No end"}</small></Link>;
        })}
        {!discounts?.length ? <p className="admin-recent__empty">No discount codes yet.</p> : null}
      </div>
    </section>
  );
}
