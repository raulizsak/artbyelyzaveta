"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BasicModal from "@/components/smoothui/basic-modal";

export function AdminOrderActions({
  orderId,
  initial,
  paymentStatus,
  orderType,
  isDemo,
}: {
  orderId: string;
  paymentStatus: string;
  orderType: string;
  isDemo: boolean;
  initial: {
    fulfillmentStatus: string;
    orderStatus: string;
    trackingCarrier: string;
    trackingNumber: string;
    trackingUrl: string;
    commissionEta: string;
    customerMessage: string;
    internalNotes: string;
    commissionStage: string;
    expectedDispatch: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [notify, setNotify] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [cancelState, setCancelState] = useState<
    "idle" | "busy" | "sent" | "error"
  >("idle");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );
  async function save(action: string) {
    setState("busy");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notify, ...form }),
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }
  async function cancelOrder(event: React.FormEvent) {
    event.preventDefault();
    setCancelState("busy");
    const response = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: cancelReason,
        notify,
        restock,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setCancelState(response.ok ? "sent" : "error");
    if (response.ok) {
      setCancelOpen(false);
      router.refresh();
    }
  }
  async function resetDemoOrder() {
    if (
      !window.confirm(
        "Reset this demo order and restore the painting? The audit history will be preserved.",
      )
    )
      return;
    setState("busy");
    const response = await fetch(`/api/admin/orders/${orderId}/reset-demo`, {
      method: "POST",
    });
    setState(response.ok ? "saved" : "error");
    if (response.ok) router.refresh();
  }
  const paid = ["paid", "partially_refunded"].includes(paymentStatus);
  const shipped = ["shipped", "delivered"].includes(form.fulfillmentStatus);
  const final = ["cancelled", "refunded"].includes(form.orderStatus);
  const field = (key: keyof typeof form, label: string) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        value={form[key]}
      />
    </label>
  );
  return (
    <section className="admin-action-panel">
      <h2>Update order</h2>
      <div className="form-grid two-col">
        <label className="form-field">
          <span>Fulfillment</span>
          <select
            onChange={(e) =>
              setForm({ ...form, fulfillmentStatus: e.target.value })
            }
            value={form.fulfillmentStatus}
          >
            <option value="unfulfilled">Unfulfilled</option>
            <option value="preparing">Preparing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option disabled value="cancelled">
              Cancelled
            </option>
            <option value="returned">Returned</option>
          </select>
        </label>
        <label className="form-field">
          <span>Order status</span>
          <select
            onChange={(e) => setForm({ ...form, orderStatus: e.target.value })}
            value={form.orderStatus}
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="delayed">Delayed</option>
            <option disabled value="cancelled">
              Cancelled
            </option>
            <option disabled value="refunded">
              Refunded
            </option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {field("trackingCarrier", "Carrier")}
        {field("trackingNumber", "Tracking number")}
        {field("trackingUrl", "Tracking URL")}
        {field("commissionEta", "Commission ETA")}
        {orderType === "commission" ? (
          <>
            <label className="form-field">
              <span>Commission stage</span>
              <select
                onChange={(event) =>
                  setForm({ ...form, commissionStage: event.target.value })
                }
                value={form.commissionStage}
              >
                <option value="enquiry">Enquiry</option>
                <option value="accepted">Accepted</option>
                <option value="deposit_paid">Deposit paid</option>
                <option value="in_progress">In progress</option>
                <option value="review">Collector review</option>
                <option value="complete">Complete</option>
                <option value="dispatched">Dispatched</option>
              </select>
            </label>
            {field("expectedDispatch", "Expected dispatch")}
          </>
        ) : null}
      </div>
      <label className="form-field">
        <span>Customer-facing message</span>
        <textarea
          onChange={(e) =>
            setForm({ ...form, customerMessage: e.target.value })
          }
          value={form.customerMessage}
        />
      </label>
      <label className="form-field">
        <span>Internal note</span>
        <textarea
          onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
          value={form.internalNotes}
        />
      </label>
      <label className="consent-field">
        <input
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          type="checkbox"
        />
        <span>Email this update to the customer</span>
      </label>
      <div className="button-row">
        <button
          className="primary-action"
          disabled={state === "busy"}
          onClick={() =>
            save(
              form.fulfillmentStatus === "shipped"
                ? "fulfill"
                : form.orderStatus === "delayed"
                  ? "delay"
                  : orderType === "commission"
                    ? "commission_update"
                    : "update",
            )
          }
          type="button"
        >
          {state === "busy" ? "Saving…" : "Save update"}
        </button>
        <button
          className="secondary-action"
          disabled={final || shipped}
          onClick={() => setCancelOpen(true)}
          type="button"
        >
          Cancel order
        </button>
        {isDemo ? (
          <button
            className="secondary-action"
            disabled={state === "busy"}
            onClick={resetDemoOrder}
            type="button"
          >
            Reset demo order
          </button>
        ) : null}
      </div>
      {shipped ? (
        <p className="form-help">
          This artwork has shipped. Use the return workflow instead of a normal
          cancellation.
        </p>
      ) : null}
      {state === "saved" ? (
        <p className="form-success-inline">
          Order updated and timeline recorded.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">The update could not be saved.</p>
      ) : null}
      <BasicModal
        isOpen={cancelOpen}
        onClose={() => cancelState !== "busy" && setCancelOpen(false)}
        size="md"
        title={paid ? "Cancel and refund order" : "Cancel order"}
      >
        <form className="refund-form" onSubmit={cancelOrder}>
          <p>
            {paid
              ? isDemo
                ? "The remaining demo amount will be recorded as refunded immediately. No payment provider is contacted."
                : "The remaining payment will be refunded through Stripe. The order changes only after Stripe confirms the refund by signed webhook."
              : "The unpaid reservation will be released immediately."}
          </p>
          <label className="form-field">
            <span>Cancellation reason</span>
            <textarea
              minLength={3}
              onChange={(event) => setCancelReason(event.target.value)}
              required
              value={cancelReason}
            />
          </label>
          <fieldset className="choice-cards">
            <legend>Inventory action</legend>
            <label>
              <input
                checked={restock}
                name="restock"
                onChange={() => setRestock(true)}
                type="radio"
              />
              <strong>Return artwork to available</strong>
              <span>{paid ? "After the full refund succeeds." : "Now."}</span>
            </label>
            <label>
              <input
                checked={!restock}
                name="restock"
                onChange={() => setRestock(false)}
                type="radio"
              />
              <strong>Keep artwork unavailable</strong>
              <span>Use this when it should not return to the shop.</span>
            </label>
          </fieldset>
          <label className="consent-field">
            <input
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              type="checkbox"
            />
            <span>Notify the customer</span>
          </label>
          <div className="button-row">
            <button
              className="primary-action"
              disabled={cancelState === "busy"}
              type="submit"
            >
              {cancelState === "busy"
                ? "Submitting…"
                : paid
                  ? isDemo
                    ? "Confirm demo refund"
                    : "Confirm full refund"
                  : "Confirm cancellation"}
            </button>
            <button
              className="secondary-action"
              disabled={cancelState === "busy"}
              onClick={() => setCancelOpen(false)}
              type="button"
            >
              Keep order
            </button>
          </div>
          {cancelState === "error" ? (
            <p className="form-error">
              The cancellation was not completed. Review the order and try
              again.
            </p>
          ) : null}
        </form>
      </BasicModal>
    </section>
  );
}
