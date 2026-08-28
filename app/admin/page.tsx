import Image from "next/image";
import Link from "next/link";
import {
  CircleAlert,
  Clock3,
  Frame,
  ImageIcon,
  MoreVertical,
  Package,
  PackageCheck,
  ScrollText,
  UserRound,
  UsersRound,
} from "lucide-react";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMelbourneDate } from "@/lib/date-time";
import { publicArtworkUrl } from "@/lib/media-url";
import { formatDisplayValue } from "@/lib/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await requireAdminAal2("/admin");
  const supabase = createAdminClient();
  const [
    paid,
    preparing,
    shipped,
    returns,
    available,
    sold,
    subscribers,
    recent,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .eq("fulfillment_status", "unfulfilled"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("fulfillment_status", "preparing"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("fulfillment_status", "shipped"),
    supabase
      .from("return_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "needs_information", "awaiting_return"]),
    supabase
      .from("paintings")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("paintings")
      .select("id", { count: "exact", head: true })
      .eq("status", "sold"),
    supabase.from("subscribers").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select(
        "order_reference, customer_first_name, customer_last_name, payment_status, fulfillment_status, is_demo, created_at, order_items(title, image_path)",
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const cards = [
    { label: "Paid · unfulfilled", value: paid.count, icon: ScrollText },
    { label: "Preparing", value: preparing.count, icon: Clock3 },
    { label: "Shipped", value: shipped.count, icon: Package },
    {
      label: "Returns requiring attention",
      value: returns.count,
      icon: CircleAlert,
    },
    { label: "Paintings available", value: available.count, icon: Frame },
    { label: "Paintings sold", value: sold.count, icon: ImageIcon },
    { label: "Subscribers", value: subscribers.count, icon: UsersRound },
  ];

  return (
    <section className="admin-overview">
      <div className="admin-overview__heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Shop overview</h1>
        </div>
        <div className="admin-readiness" role="status">
          <PackageCheck aria-hidden="true" size={22} strokeWidth={1.45} />
          <span>
            <strong>Store dashboard ready</strong>
            <small>Updated just now</small>
          </span>
          <i aria-label="Ready" />
        </div>
      </div>

      <div className="admin-metric-grid">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label}>
            <span className="admin-metric-icon">
              <Icon aria-hidden="true" size={24} strokeWidth={1.45} />
            </span>
            <strong>{value ?? 0}</strong>
            <p>{label}</p>
            <span className="admin-metric-rule" />
          </article>
        ))}
      </div>

      <div className="admin-recent">
        <div className="section-heading">
          <h2>Recent orders</h2>
          <Link href="/admin/orders">View all →</Link>
        </div>
        <div className="admin-recent__list">
          {recent.data?.map((order) => {
            const items = order.order_items as unknown as Array<{
              title: string;
              image_path: string | null;
            }>;
            const image =
              publicArtworkUrl(items[0]?.image_path) ||
              "/optimized/artwork/cows-at-dusk-warm-room-thumbnail.webp";
            return (
              <Link
                className="admin-recent-order"
                href={`/admin/orders/${order.order_reference}`}
                key={order.order_reference}
              >
                <Image
                  alt={items[0]?.title ?? "Original artwork"}
                  height={74}
                  src={image}
                  width={74}
                />
                <span className="admin-recent-order__reference">
                  <strong>
                    {order.order_reference}
                    {order.is_demo ? " · DEMO" : ""}
                  </strong>
                  <small>{formatMelbourneDate(order.created_at)}</small>
                </span>
                <span className="admin-recent-order__customer">
                  <UserRound aria-hidden="true" size={18} />
                  <span>
                    <strong>
                      {order.customer_first_name} {order.customer_last_name}
                    </strong>
                    <small>
                      {formatDisplayValue(order.payment_status)} ·{" "}
                      {formatDisplayValue(order.fulfillment_status)}
                    </small>
                  </span>
                </span>
                <span className="admin-recent-order__more" aria-hidden="true">
                  <MoreVertical size={18} />
                </span>
              </Link>
            );
          })}
          {!recent.data?.length ? (
            <div className="admin-recent__empty">
              No orders have been placed yet.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
