"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/catalog";

export function RefundForm({
  orderId,
  total,
  amountRefunded,
  isDemo,
}: {
  orderId: string;
  total: number;
  amountRefunded: number;
  isDemo: boolean;
}) {
  const router = useRouter();
  const remaining = total - amountRefunded;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: Math.round(Number(amount) * 100),
        reason,
        idempotencyKey: crypto.randomUUID(),
        restock,
      }),
    });
    setState(response.ok ? "sent" : "error");
    if (response.ok) router.refresh();
  }
  return (
    <form className="refund-form" onSubmit={submit}>
      <h3>Issue refund</h3>
      <p>Remaining refundable: {formatMoney(remaining)}</p>
      <label className="form-field">
        <span>Amount (AUD)</span>
        <input
          max={(remaining / 100).toFixed(2)}
          min="0.01"
          onChange={(e) => setAmount(e.target.value)}
          required
          step="0.01"
          type="number"
          value={amount}
        />
      </label>
      <label className="form-field">
        <span>Reason</span>
        <textarea
          minLength={3}
          onChange={(e) => setReason(e.target.value)}
          required
          value={reason}
        />
      </label>
      {isDemo ? (
        <label className="consent-field">
          <input
            checked={restock}
            onChange={(event) => setRestock(event.target.checked)}
            type="checkbox"
          />
          <span>Return the artwork to available after a full refund</span>
        </label>
      ) : null}
      <button
        className="secondary-action"
        disabled={state === "busy" || remaining <= 0}
        type="submit"
      >
        {state === "busy"
          ? "Submitting…"
          : isDemo
            ? "Record demo refund"
            : "Refund in TEST MODE"}
      </button>
      {state === "sent" ? (
        <p className="form-success-inline">
          {isDemo
            ? "Demo refund recorded. No payment provider was contacted."
            : "Refund submitted; the signed webhook will finalize its status."}
        </p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">
          {isDemo
            ? "The demo refund could not be recorded."
            : "Stripe did not accept the refund. Database state was not marked successful."}
        </p>
      ) : null}
    </form>
  );
}
