import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminOrderActions } from "@/components/admin-order-actions";
import { EmailInvoiceButton } from "@/components/email-invoice-button";
import { RefundForm } from "@/components/refund-form";
import { ResendOrderEmailButton } from "@/components/resend-order-email-button";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMoney } from "@/lib/catalog";
import { formatMelbourneDateTime } from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const reference = (await params).reference;
  await requireAdminAal2(`/admin/orders/${encodeURIComponent(reference)}`);
  const { data: order } = await createAdminClient()
    .from("orders")
    .select(
      "*, order_items(*), order_discounts(*), order_events(*), refunds(*), invoices(*)",
    )
    .eq("order_reference", reference)
    .maybeSingle();
  if (!order) notFound();
  const items = order.order_items as unknown as {
    id: string;
    title: string;
    dimensions: string | null;
    medium: string | null;
    unit_price_cents: number;
  }[];
  const events = (
    order.order_events as unknown as {
      id: string;
      customer_safe_description: string;
      created_at: string;
    }[]
  ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const discounts = order.order_discounts as unknown as {
    id: string;
    code: string;
    applied_cents: number;
  }[];
  const address = order.shipping_address as Record<string, string>;
  return (
    <section className="account-panel">
      <Link className="text-button" href="/admin/orders">
        ← Orders
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{order.order_type} order</p>
          <h1>
            {order.order_reference}{" "}
            {order.is_demo ? <span className="demo-badge">DEMO</span> : null}
          </h1>
        </div>
        <div className="status-row">
          <span>{formatDisplayValue(order.payment_status)}</span>
          <span>{formatDisplayValue(order.fulfillment_status)}</span>
        </div>
      </div>
      <div className="detail-grid">
        <article>
          <h2>Artwork</h2>
          {items.map((item) => (
            <div key={item.id}>
              <strong>{item.title}</strong>
              <p>
                {item.medium} · {item.dimensions}
              </p>
              <p>{formatMoney(item.unit_price_cents, order.currency)}</p>
            </div>
          ))}
          <hr />
          <dl className="financial-breakdown">
            <div>
              <dt>Artwork subtotal</dt>
              <dd>{formatMoney(order.subtotal_cents, order.currency)}</dd>
            </div>
            {discounts.map((discount) => (
              <div key={discount.id}>
                <dt>{discount.code}</dt>
                <dd>−{formatMoney(discount.applied_cents, order.currency)}</dd>
              </div>
            ))}
            {!discounts.length && order.discount_cents > 0 ? (
              <div>
                <dt>Discount</dt>
                <dd>−{formatMoney(order.discount_cents, order.currency)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Shipping</dt>
              <dd>{formatMoney(order.shipping_cents, order.currency)}</dd>
            </div>
            {order.tax_cents > 0 ? (
              <div>
                <dt>GST / tax</dt>
                <dd>{formatMoney(order.tax_cents, order.currency)}</dd>
              </div>
            ) : null}
            <div className="financial-breakdown__total">
              <dt>Total paid</dt>
              <dd>
                {formatMoney(
                  order.amount_paid_cents ?? order.total_cents,
                  order.currency,
                )}
              </dd>
            </div>
          </dl>
        </article>
        <article>
          <h2>Customer</h2>
          <p>
            {order.customer_first_name} {order.customer_last_name}
            <br />
            <a href={`mailto:${order.customer_email}`}>
              {order.customer_email}
            </a>
            <br />
            {order.customer_phone}
          </p>
          <p>
            <strong>Delivery:</strong>{" "}
            {formatDisplayValue(order.delivery_method)}
          </p>
          {order.delivery_method === "shipping" ? (
            <address>
              {address.recipient_name}
              <br />
              {address.line1}
              <br />
              {address.suburb} {address.state} {address.postcode}
              <br />
              {address.country}
            </address>
          ) : (
            <p>
              Personal Collection · Shipping charged:{" "}
              {formatMoney(order.shipping_cents, order.currency)}
            </p>
          )}
        </article>
      </div>
      <section className="admin-action-panel tracking-summary">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Shipment</p>
            <h2>Tracking</h2>
          </div>
          {order.tracking_status ? (
            <span className="status-pill">
              {formatDisplayValue(order.tracking_status)}
            </span>
          ) : null}
        </div>
        <dl className="detail-list">
          <div>
            <dt>Carrier</dt>
            <dd>{order.tracking_carrier || "Not set"}</dd>
          </div>
          <div>
            <dt>Tracking number</dt>
            <dd>{order.tracking_number || "Not set"}</dd>
          </div>
          <div>
            <dt>Tracking link</dt>
            <dd>
              {order.tracking_url ? (
                <a href={order.tracking_url} rel="noreferrer" target="_blank">
                  Open carrier tracking
                </a>
              ) : (
                "Not set"
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatDisplayValue(order.tracking_status, "Not checked")}</dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>
              {order.last_tracking_check_at
                ? formatMelbourneDateTime(order.last_tracking_check_at)
                : "Not checked yet"}
            </dd>
          </div>
          <div>
            <dt>Delivered</dt>
            <dd>
              {order.delivered_at
                ? formatMelbourneDateTime(order.delivered_at)
                : "Not delivered"}
            </dd>
          </div>
          {order.tracking_error ? (
            <div>
              <dt>Latest error</dt>
              <dd>{order.tracking_error}</dd>
            </div>
          ) : null}
        </dl>
      </section>
      <AdminOrderActions
        initial={{
          fulfillmentStatus: order.fulfillment_status,
          orderStatus: order.order_status,
          trackingCarrier: order.tracking_carrier ?? "",
          trackingNumber: order.tracking_number ?? "",
          trackingUrl: order.tracking_url ?? "",
          commissionEta: order.commission_eta ?? "",
          customerMessage: order.customer_status_message ?? "",
          internalNotes: order.internal_admin_notes ?? "",
          commissionStage: order.commission_stage ?? "enquiry",
          expectedDispatch: order.expected_dispatch ?? "",
        }}
        orderId={order.id}
        orderType={order.order_type}
        paymentStatus={order.payment_status}
        isDemo={order.is_demo}
      />
      <div className="detail-grid">
        <section>
          <h2>Timeline</h2>
          <ol className="order-timeline">
            {events.map((event) => (
              <li key={event.id}>
                <span />
                <div>
                  <strong>{event.customer_safe_description}</strong>
                  <small>{formatMelbourneDateTime(event.created_at)}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h2>Stripe invoice and refund</h2>
          {order.invoices.some((invoice) => invoice.stripe_invoice_id) ||
          order.is_demo ? (
            <a
              className="secondary-action"
              href={`/api/orders/${order.order_reference}/invoice`}
              target="_blank"
            >
              View Stripe invoice PDF
            </a>
          ) : null}
          {!order.is_demo && order.payment_status === "paid" ? (
            <EmailInvoiceButton orderId={order.id} />
          ) : null}
          <ResendOrderEmailButton orderId={order.id} />
          {order.payment_status === "paid" ||
          order.payment_status === "partially_refunded" ? (
            <RefundForm
              amountRefunded={order.amount_refunded_cents}
              orderId={order.id}
              total={order.total_cents}
              isDemo={order.is_demo}
            />
          ) : (
            <p>Refund actions become available after a confirmed payment.</p>
          )}
        </section>
      </div>
    </section>
  );
}
