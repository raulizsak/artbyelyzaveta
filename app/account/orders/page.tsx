import Link from "next/link";
import { formatMoney } from "@/lib/catalog";
import { requireAccount } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireAccount("/account/orders");
  const { data: orders } = await (await createClient())
    .from("orders")
    .select(
      "order_reference, created_at, total_cents, currency, payment_status, fulfillment_status, commission_eta, tracking_url, order_items(title)",
    )
    .order("created_at", { ascending: false })
    .limit(24);
  return (
    <section className="account-panel">
      <p className="eyebrow">Orders</p>
      <h1>Your artwork orders</h1>
      {orders?.length ? (
        <div className="order-list">
          {orders.map((order) => {
            const items = order.order_items as unknown as { title: string }[];
            return (
              <Link
                className="order-card"
                href={`/account/orders/${order.order_reference}`}
                key={order.order_reference}
              >
                <span>
                  <strong>{order.order_reference}</strong>
                  <small>
                    {new Intl.DateTimeFormat("en-AU", {
                      dateStyle: "medium",
                    }).format(new Date(order.created_at))}
                  </small>
                </span>
                <span>
                  <strong>{items[0]?.title ?? "Artwork"}</strong>
                  <small>
                    {order.payment_status} · {order.fulfillment_status}
                  </small>
                </span>
                <strong>
                  {formatMoney(order.total_cents, order.currency)}
                </strong>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No orders yet</h2>
          <p>
            When you purchase an original or commission, it will appear here.
          </p>
          <Link className="cta-link" href="/shop">
            Explore paintings
          </Link>
        </div>
      )}
    </section>
  );
}
