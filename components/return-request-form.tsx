"use client";

import { useState } from "react";
import { ReturnEvidenceUploader } from "@/components/return-evidence-uploader";

export function ReturnRequestForm({
  orderId,
  maximumCents,
  userId,
}: {
  orderId: string;
  maximumCents: number;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Changed my mind");
  const [explanation, setExplanation] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  const [returnId, setReturnId] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const response = await fetch("/api/account/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        reason,
        explanation,
        requestedRefundCents: maximumCents,
      }),
    });
    const body = (await response.json()) as { id?: string };
    if (response.ok && body.id) {
      setReturnId(body.id);
      setState("sent");
    } else setState("error");
  }
  if (state === "sent")
    return (
      <div className="notice return-evidence-upload">
        <strong>Return request received</strong>
        <p>
          Elyzaveta will review it and respond through your account and email.
        </p>
        <ReturnEvidenceUploader returnId={returnId} userId={userId} />
      </div>
    );
  return (
    <section className="return-action">
      <h2>Need help with this order?</h2>
      {!open ? (
        <button
          className="secondary-action"
          onClick={() => setOpen(true)}
          type="button"
        >
          Request a return
        </button>
      ) : (
        <form onSubmit={submit}>
          <label className="form-field">
            <span>Reason</span>
            <select onChange={(e) => setReason(e.target.value)} value={reason}>
              <option>Changed my mind</option>
              <option>Artwork arrived damaged</option>
              <option>Incorrect item</option>
              <option>Other</option>
            </select>
          </label>
          <label className="form-field">
            <span>Tell us what happened</span>
            <textarea
              minLength={10}
              onChange={(e) => setExplanation(e.target.value)}
              required
              rows={5}
              value={explanation}
            />
          </label>
          <button
            className="primary-action"
            disabled={state === "busy"}
            type="submit"
          >
            {state === "busy" ? "Sending…" : "Send request"}
          </button>
          {state === "error" ? (
            <p className="form-error">
              We couldn&apos;t send the request. It may already have been
              submitted.
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
