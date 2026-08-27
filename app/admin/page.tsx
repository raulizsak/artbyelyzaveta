import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
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
        "order_reference, customer_first_name, customer_last_name, payment_status, fulfillment_status, is_demo, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const cards = [
    ["Paid · unfulfilled", paid.count],
    ["Preparing", preparing.count],
    ["Shipped", shipped.count],
    ["Returns requiring attention", returns.count],
    ["Paintings available", available.count],
    ["Paintings sold", sold.count],
    ["Launch subscribers", subscribers.count],
  ];
  return (
    <section className="account-panel">
      <p className="eyebrow">Operations</p>
      <h1>Shop overview</h1>
      <div className="metric-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <strong>{value ?? 0}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <h2>Recent orders</h2>
        <Link href="/admin/orders">View all</Link>
      </div>
      <div className="order-list">
        {recent.data?.map((order) => (
          <Link
            className="order-card"
            href={`/admin/orders/${order.order_reference}`}
            key={order.order_reference}
          >
            <span>
              <strong>
                {order.order_reference}
                {order.is_demo ? " · DEMO" : ""}
              </strong>
              <small>
                {new Intl.DateTimeFormat("en-AU", {
                  dateStyle: "medium",
                }).format(new Date(order.created_at))}
              </small>
            </span>
            <span>
              <strong>
                {order.customer_first_name} {order.customer_last_name}
              </strong>
              <small>
                {order.payment_status} · {order.fulfillment_status}
              </small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
