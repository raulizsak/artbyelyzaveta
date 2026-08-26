"use client";

import { useState } from "react";

export function ResendOrderEmailButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );

  async function resend() {
    setState("busy");
    const response = await fetch(
      `/api/admin/orders/${orderId}/resend-confirmation`,
      { method: "POST" },
    );
    setState(response.ok ? "sent" : "error");
  }

  return (
    <>
      <button
        className="secondary-action"
        disabled={state === "busy"}
        onClick={resend}
        type="button"
      >
        {state === "busy"
          ? "Queueing…"
          : state === "sent"
            ? "Confirmation queued"
            : "Resend order confirmation"}
      </button>
      {state === "error" ? (
        <p className="form-error">The confirmation could not be queued.</p>
      ) : null}
    </>
  );
}
