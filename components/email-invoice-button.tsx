"use client";

import { useState } from "react";

export function EmailInvoiceButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  async function send() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/invoice-email`,
        { method: "POST" },
      );
      const body = (await response.json()) as { message?: string };
      setMessage(body.message || "");
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
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
          ? "Sending through Stripe…"
          : state === "sent"
            ? "Stripe invoice sent"
            : "Send Stripe invoice"}
      </button>
      {state === "sent" && message ? (
        <p className="form-success-inline">{message}</p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">Stripe could not send the invoice.</p>
      ) : null}
    </>
  );
}
