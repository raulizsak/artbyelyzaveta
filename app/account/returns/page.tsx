import Link from "next/link";
import { requireAccount } from "@/lib/auth/authorization";
import { formatMelbourneDate } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  await requireAccount("/account/returns");
  const { data } = await (await createClient())
    .from("return_requests")
    .select(
      "id, reason, status, admin_response, created_at, orders(order_reference)",
    )
    .order("created_at", { ascending: false });
  return (
    <section className="account-panel">
      <p className="eyebrow">Returns</p>
      <h1>Return requests</h1>
      {data?.length ? (
        <div className="order-list">
          {data.map((request) => {
            const order = request.orders as unknown as {
              order_reference: string;
            };
            return (
              <article className="order-card" key={request.id}>
                <span>
                  <strong>{request.reason}</strong>
                  <small>{formatMelbourneDate(request.created_at)}</small>
                </span>
                <span>
                  <strong>{request.status}</strong>
                  <small>{request.admin_response || "Awaiting review"}</small>
                </span>
                <Link href={`/account/orders/${order.order_reference}`}>
                  View order
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No return requests</h2>
          <p>You can start a request from an eligible paid order.</p>
          <Link className="secondary-action" href="/account/orders">
            View orders
          </Link>
        </div>
      )}
    </section>
  );
}
