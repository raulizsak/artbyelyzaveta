import Link from "next/link";
import {
  Check,
  ClockAlert,
  FileText,
  PackageCheck,
  Palette,
  Truck,
} from "lucide-react";

type OrderProgressProps = {
  reference: string;
  fulfillmentStatus: string;
  orderStatus: string;
  deliveredAt: string | null;
  expectedDispatch: string | null;
  commissionEta: string | null;
  customerMessage: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  invoiceAvailable: boolean;
};

const stages = [
  { key: "placed", label: "Order placed", icon: PackageCheck },
  { key: "preparing", label: "Preparing", icon: Palette },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Check },
];

const stageIndex: Record<string, number> = {
  unfulfilled: 0,
  preparing: 1,
  shipped: 2,
  delivered: 3,
};

const date = (value: string) =>
  new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(
    new Date(value),
  );

export function OrderProgress(props: OrderProgressProps) {
  const current = stageIndex[props.fulfillmentStatus] ?? 0;
  const cancelled = props.orderStatus === "cancelled";
  const delayed = props.orderStatus === "delayed";
  return (
    <section className="order-progress" aria-labelledby="order-progress-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live order status</p>
          <h2 id="order-progress-title">
            {cancelled
              ? "This order was cancelled"
              : delayed
                ? "Your artwork is delayed"
                : (stages[current]?.label ?? "Order placed")}
          </h2>
        </div>
        <span
          className={`order-status-pill order-status-pill--${cancelled ? "cancelled" : delayed ? "delayed" : "active"}`}
        >
          {cancelled
            ? "Cancelled"
            : delayed
              ? "Delayed"
              : stages[current]?.label}
        </span>
      </div>
      {delayed || cancelled ? (
        <div
          className={`order-exception order-exception--${cancelled ? "cancelled" : "delayed"}`}
        >
          <ClockAlert aria-hidden="true" />
          <div>
            <strong>{cancelled ? "Order cancelled" : "A studio update"}</strong>
            <p>
              {props.customerMessage ||
                (cancelled
                  ? "This order will not proceed."
                  : "Elyzaveta will share a revised timeframe as soon as possible.")}
            </p>
            {!cancelled && (props.expectedDispatch || props.commissionEta) ? (
              <small>
                Updated estimate:{" "}
                {date(
                  `${props.expectedDispatch || props.commissionEta}T00:00:00`,
                )}
              </small>
            ) : null}
          </div>
        </div>
      ) : null}
      <ol className="order-stage-list">
        {stages.map(({ key, label, icon: Icon }, index) => {
          const complete = !cancelled && index < current;
          const active = !cancelled && index === current;
          return (
            <li
              className={complete ? "is-complete" : active ? "is-active" : ""}
              key={key}
            >
              <span>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <strong>{label}</strong>
                {key === "shipped" && props.trackingNumber ? (
                  <small>Tracking {props.trackingNumber}</small>
                ) : null}
                {key === "delivered" && props.deliveredAt ? (
                  <small>{date(props.deliveredAt)}</small>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="order-progress__actions">
        {props.trackingUrl ? (
          <a
            className="primary-action"
            href={props.trackingUrl}
            rel="noreferrer"
            target="_blank"
          >
            Track delivery
          </a>
        ) : null}
        {props.invoiceAvailable ? (
          <Link
            className="secondary-action"
            href={`/api/orders/${encodeURIComponent(props.reference)}/invoice`}
          >
            <FileText aria-hidden="true" size={17} /> View invoice
          </Link>
        ) : null}
      </div>
    </section>
  );
}
