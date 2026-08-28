import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMoney } from "@/lib/catalog";
import { formatMelbourneDate } from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await requireAdminAal2("/admin/paintings");
  const { data } = await createAdminClient()
    .from("paintings")
    .select(
      "id, slug, title, price_cents, currency, status, featured, updated_at, painting_media(id)",
    )
    .order("updated_at", { ascending: false });
  return (
    <section className="account-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Paintings</h1>
        </div>
        <Link className="primary-action" href="/admin/paintings/new">
          Add painting
        </Link>
      </div>
      <div className="admin-order-table">
        <div className="admin-order-table__head">
          <span>Painting</span>
          <span>Status</span>
          <span>Price</span>
          <span>Media</span>
          <span>Updated</span>
        </div>
        {data?.map((painting) => (
          <Link
            className="admin-order-row"
            href={`/admin/paintings/${painting.id}`}
            key={painting.id}
          >
            <span>
              <strong>{painting.title}</strong>
              <small>/{painting.slug}</small>
            </span>
            <span>
              {formatDisplayValue(painting.status)}
              {painting.featured ? " · Featured" : ""}
            </span>
            <strong>
              {formatMoney(painting.price_cents, painting.currency)}
            </strong>
            <span>
              {(painting.painting_media as unknown[]).length} variants
            </span>
            <small>{formatMelbourneDate(painting.updated_at)}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
