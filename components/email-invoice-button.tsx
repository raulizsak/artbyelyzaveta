"use client";

import { useState } from "react";

export function EmailInvoiceButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  async function send() {
    setState("busy");
    const response = await fetch(`/api/admin/orders/${orderId}/invoice-email`, {
      method: "POST",
    });
    setState(response.ok ? "sent" : "error");
  }
  return (
    <>
      <button
        className="secondary-action"
        disabled={state === "busy"}
        onClick={send}
        type="button"
      >
        {state === "busy"
          ? "Queueing…"
          : state === "sent"
            ? "Invoice email queued"
            : "Email invoice"}
      </button>
      {state === "error" ? (
        <p className="form-error">Invoice email could not be queued.</p>
      ) : null}
    </>
  );
}
