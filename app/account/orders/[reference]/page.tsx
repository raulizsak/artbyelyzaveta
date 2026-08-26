import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnRequestForm } from "@/components/return-request-form";
import { formatMoney } from "@/lib/catalog";
import { requireAccount } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await requireAccount("/account/orders");
  const reference = (await params).reference;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_reference, created_at, total_cents, currency, payment_status, fulfillment_status, order_status, shipping_address, delivery_method, tracking_carrier, tracking_number, tracking_url, commission_eta, commission_stage, expected_dispatch, customer_status_message, order_items(title, image_path, dimensions, medium), order_events(event_type, customer_safe_description, created_at), invoices(id, invoice_reference)",
    )
    .eq("order_reference", reference)
    .maybeSingle();
  if (!order) notFound();
  const items = order.order_items as unknown as {
    title: string;
    image_path: string | null;
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
  const address = order.shipping_address as Record<string, string>;
  return (
    <section className="account-panel">
      <Link className="text-button" href="/account/orders">
        ← All orders
      </Link>
      <p className="eyebrow">Order detail</p>
      <h1>{order.order_reference}</h1>
      <div className="status-row">
        <span>{order.payment_status}</span>
        <span>{order.fulfillment_status}</span>
        <span>{order.order_status}</span>
      </div>
      <div className="detail-grid">
        <article>
          <h2>{items[0]?.title ?? "Artwork"}</h2>
          <p>
            {[items[0]?.medium, items[0]?.dimensions]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <strong>{formatMoney(order.total_cents, order.currency)}</strong>
        </article>
        <article>
          <h2>Delivery</h2>
          {order.delivery_method === "collection" ? (
            <p>Personal collection</p>
          ) : (
            <address>
              {address.recipient_name}
              <br />
              {address.line1}
              <br />
              {address.suburb} {address.state} {address.postcode}
              <br />
              {address.country}
            </address>
          )}
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
            <p>Tracking will appear here after dispatch.</p>
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
              ? `Estimated completion: ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(new Date(`${order.commission_eta}T00:00:00`))}. `
              : ""}
            {order.expected_dispatch
              ? `Expected dispatch: ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(new Date(`${order.expected_dispatch}T00:00:00`))}.`
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
                <small>
                  {new Intl.DateTimeFormat("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.created_at))}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <ReturnRequestForm
        orderId={order.id}
        maximumCents={order.total_cents}
        userId={user.id}
      />
    </section>
  );
}
