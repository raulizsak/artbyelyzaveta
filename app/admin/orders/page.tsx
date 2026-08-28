import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMoney } from "@/lib/catalog";
import { formatMelbourneDate } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 25;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const search = (params.q || "")
    .replace(/[^a-zA-Z0-9@. +_-]/g, "")
    .slice(0, 80);
  await requireAdminAal2("/admin/orders");
  const supabase = createAdminClient();
  let matchingOrderIds: string[] = [];
  if (search) {
    const { data: matchingItems } = await supabase
      .from("order_items")
      .select("order_id")
      .ilike("title", `%${search}%`)
      .limit(100);
    matchingOrderIds = [
      ...new Set((matchingItems ?? []).map((item) => item.order_id)),
    ];
  }
  let query = supabase
    .from("orders")
    .select(
      "order_reference, created_at, customer_first_name, customer_last_name, customer_email, total_cents, currency, payment_status, fulfillment_status, order_status, order_type, commission_eta, is_demo, order_items(title)",
      { count: "exact" },
    );
  if (search)
    query = query.or(
      [
        `order_reference.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
        `customer_first_name.ilike.%${search}%`,
        `customer_last_name.ilike.%${search}%`,
        matchingOrderIds.length
          ? `id.in.(${matchingOrderIds.join(",")})`
          : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  if (params.status === "paid") query = query.eq("payment_status", "paid");
  else if (
    ["unfulfilled", "preparing", "shipped", "delivered"].includes(
      params.status || "",
    )
  )
    query = query.eq("fulfillment_status", params.status!);
  else if (["delayed", "cancelled", "refunded"].includes(params.status || ""))
    query = query.eq("order_status", params.status!);
  else if (params.status === "commission")
    query = query.eq("order_type", "commission");
  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  return (
    <section className="account-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>Order management</h1>
        </div>
      </div>
      <form className="admin-filters">
        <input
          defaultValue={search}
          name="q"
          placeholder="Search order, customer, email or artwork"
        />
        <select defaultValue={params.status || "all"} name="status">
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="unfulfilled">Unfulfilled</option>
          <option value="preparing">Preparing</option>
          <option value="shipped">Shipped</option>
          <option value="delayed">Delayed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
          <option value="commission">Commission</option>
        </select>
        <button className="secondary-action" type="submit">
          Filter
        </button>
      </form>
      <div className="admin-order-table">
        <div className="admin-order-table__head">
          <span>Order</span>
          <span>Customer</span>
          <span>Artwork</span>
          <span>Total</span>
          <span>Status</span>
        </div>
        {data?.map((order) => {
          const items = order.order_items as unknown as { title: string }[];
          return (
            <Link
              className="admin-order-row"
              href={`/admin/orders/${order.order_reference}`}
              key={order.order_reference}
            >
              <span>
                <strong>
                  {order.order_reference}{" "}
                  {order.is_demo ? (
                    <span className="demo-badge">DEMO</span>
                  ) : null}
                </strong>
                <small>{formatMelbourneDate(order.created_at)}</small>
              </span>
              <span>
                <strong>
                  {order.customer_first_name} {order.customer_last_name}
                </strong>
                <small>{order.customer_email}</small>
              </span>
              <span>{items[0]?.title ?? "Artwork"}</span>
              <strong>{formatMoney(order.total_cents, order.currency)}</strong>
              <span>
                <small>{order.payment_status}</small>
                <small>{order.fulfillment_status}</small>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="pagination">
        {page > 1 ? (
          <Link
            href={`?page=${page - 1}&q=${encodeURIComponent(search)}&status=${params.status || "all"}`}
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {(count ?? 0) > page * PAGE_SIZE ? (
          <Link
            href={`?page=${page + 1}&q=${encodeURIComponent(search)}&status=${params.status || "all"}`}
          >
            Next
          </Link>
        ) : null}
      </div>
    </section>
  );
}
