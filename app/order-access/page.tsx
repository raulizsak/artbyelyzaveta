import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/catalog";
import { formatMelbourneDate, formatMelbourneDateTime } from "@/lib/date-time";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private order access",
  robots: { index: false, follow: false },
};

export default async function GuestOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  if (!/^[a-f0-9]{64}$/i.test(token)) notFound();

  const admin = createAdminClient();
  const { data: orderId } = await admin.rpc("lookup_guest_order", {
    p_token: token,
  });
  if (!orderId) notFound();

  const { data: order } = await admin
    .from("orders")
    .select(
      "order_reference, created_at, total_cents, currency, payment_status, fulfillment_status, order_status, delivery_method, tracking_carrier, tracking_url, commission_eta, commission_stage, expected_dispatch, customer_status_message, order_items(title, dimensions, medium), order_events(event_type, customer_safe_description, created_at)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) notFound();

  const items = order.order_items as unknown as {
    title: string;
    dimensions: string | null;
    medium: string | null;
  }[];
  const events = (
    order.order_events as unknown as {
      event_type: string;
      customer_safe_description: string;
      created_at: string;
    }[]
  ).sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <main className="account-panel shell guest-order" id="main-content">
      <p className="eyebrow">Private guest order</p>
      <h1>{order.order_reference}</h1>
      <p>
        Keep this private link safe. It expires automatically and grants access
        only to this order.
      </p>
      <div className="status-row">
        <span>{order.payment_status}</span>
        <span>{order.fulfillment_status}</span>
        <span>{order.order_status}</span>
      </div>
      <div className="detail-grid">
        <article>
          <h2>{items[0]?.title ?? "Original artwork"}</h2>
          <p>
            {[items[0]?.medium, items[0]?.dimensions]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <strong>{formatMoney(order.total_cents, order.currency)}</strong>
        </article>
        <article>
          <h2>Delivery</h2>
          <p>
            {order.delivery_method === "collection"
              ? "Personal collection"
              : "Shipping arrangement"}
          </p>
          {order.tracking_url ? (
            <a
              className="cta-link"
              href={order.tracking_url}
              rel="noreferrer"
              target="_blank"
            >
              Track with {order.tracking_carrier || "carrier"}
            </a>
          ) : (
            <p>Tracking will appear after dispatch.</p>
          )}
        </article>
      </div>
      {order.customer_status_message ? (
        <div className="notice">
          <strong>Update from Elyzaveta</strong>
          <p>{order.customer_status_message}</p>
        </div>
      ) : null}
      {order.commission_stage ? (
        <div className="notice">
          <strong>
            Commission progress: {order.commission_stage.replaceAll("_", " ")}
          </strong>
          <p>
            {order.commission_eta
              ? `Estimated completion: ${formatMelbourneDate(`${order.commission_eta}T00:00:00`, "long")}. `
              : ""}
            {order.expected_dispatch
              ? `Expected dispatch: ${formatMelbourneDate(`${order.expected_dispatch}T00:00:00`, "long")}.`
              : ""}
          </p>
        </div>
      ) : null}
      <section>
        <h2>Timeline</h2>
        <ol className="order-timeline">
          {events.map((event) => (
            <li key={`${event.created_at}-${event.event_type}`}>
              <span />
              <div>
                <strong>{event.customer_safe_description}</strong>
                <small>{formatMelbourneDateTime(event.created_at)}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="button-row">
        <a
          className="primary-action"
          href={`/api/orders/${encodeURIComponent(order.order_reference)}/invoice?token=${encodeURIComponent(token)}`}
        >
          View invoice
        </a>
        <Link className="secondary-action" href="/signup">
          Create an account
        </Link>
      </div>
    </main>
  );
}
