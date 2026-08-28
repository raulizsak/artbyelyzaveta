import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnRequestForm } from "@/components/return-request-form";
import { OrderProgress } from "@/components/order-progress";
import { formatMoney } from "@/lib/catalog";
import { requireAccount } from "@/lib/auth/authorization";
import { formatMelbourneDate, formatMelbourneDateTime } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";
import { publicArtworkUrl } from "@/lib/media-url";
import { formatDisplayValue } from "@/lib/presentation";

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
      "id, order_reference, created_at, delivered_at, cancelled_at, total_cents, currency, payment_status, fulfillment_status, order_status, shipping_address, delivery_method, tracking_carrier, tracking_number, tracking_url, commission_eta, commission_stage, expected_dispatch, customer_status_message, order_items(title, image_path, dimensions, medium), order_events(event_type, customer_safe_description, created_at), invoices(id, invoice_reference)",
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
  const invoices = order.invoices as unknown as {
    id: string;
    invoice_reference: string;
  }[];
  const artworkImage = publicArtworkUrl(items[0]?.image_path);
  return (
    <section className="account-panel">
      <Link className="text-button" href="/account/orders">
        ← All orders
      </Link>
      <p className="eyebrow">Order detail</p>
      <h1>{order.order_reference}</h1>
      <div className="status-row order-summary-statuses">
        <span>{formatDisplayValue(order.payment_status)}</span>
        <span>{formatDisplayValue(order.fulfillment_status)}</span>
        <span>{formatDisplayValue(order.order_status)}</span>
      </div>
      <OrderProgress
        commissionEta={order.commission_eta}
        customerMessage={order.customer_status_message}
        deliveredAt={order.delivered_at}
        expectedDispatch={order.expected_dispatch}
        fulfillmentStatus={order.fulfillment_status}
        invoiceAvailable={
          invoices.length > 0 ||
          ["paid", "partially_refunded", "refunded"].includes(
            order.payment_status,
          )
        }
        orderStatus={order.order_status}
        reference={order.order_reference}
        trackingNumber={order.tracking_number}
        trackingUrl={order.tracking_url}
      />
      <div className="detail-grid">
        <article className="order-artwork-summary">
          {artworkImage ? (
            <Image
              alt={items[0]?.title ?? "Ordered artwork"}
              height={180}
              src={artworkImage}
              width={180}
            />
          ) : null}
          <div>
            <h2>{items[0]?.title ?? "Artwork"}</h2>
            <p>
              {[items[0]?.medium, items[0]?.dimensions]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <strong>{formatMoney(order.total_cents, order.currency)}</strong>
          </div>
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
      {order.customer_status_message && order.order_status !== "delayed" ? (
        <div className="notice">
          <strong>Update from Elyzaveta</strong>
          <p>{order.customer_status_message}</p>
        </div>
      ) : null}
      {order.commission_stage ? (
        <div className="notice">
          <strong>
            Commission progress: {formatDisplayValue(order.commission_stage)}
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
        <h2>Order activity</h2>
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
      <ReturnRequestForm
        orderId={order.id}
        maximumCents={order.total_cents}
        userId={user.id}
      />
    </section>
  );
}
