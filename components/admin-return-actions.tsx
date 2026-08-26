"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminReturnActions({
  returnId,
  initialStatus,
  maximumCents,
}: {
  returnId: string;
  initialStatus: string;
  maximumCents: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [response, setResponse] = useState("");
  const [refund, setRefund] = useState(
    maximumCents ? (maximumCents / 100).toFixed(2) : "",
  );
  const [notify, setNotify] = useState(true);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const result = await fetch(`/api/admin/returns/${returnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        response,
        approvedRefundCents: refund ? Math.round(Number(refund) * 100) : null,
        notify,
      }),
    });
    setState(result.ok ? "saved" : "error");
    if (result.ok) router.refresh();
  }
  return (
    <form className="admin-action-panel" onSubmit={save}>
      <label className="form-field">
        <span>Status</span>
        <select onChange={(e) => setStatus(e.target.value)} value={status}>
          <option value="requested">Requested</option>
          <option value="needs_information">Needs information</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="awaiting_return">Awaiting return</option>
          <option value="received">Received</option>
          <option value="refunded">Refunded</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <label className="form-field">
        <span>Response to customer</span>
        <textarea
          onChange={(e) => setResponse(e.target.value)}
          rows={4}
          value={response}
        />
      </label>
      <label className="form-field">
        <span>Approved refund (AUD)</span>
        <input
          max={maximumCents ? maximumCents / 100 : undefined}
          min="0"
          onChange={(e) => setRefund(e.target.value)}
          step="0.01"
          type="number"
          value={refund}
        />
      </label>
      <label className="consent-field">
        <input
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          type="checkbox"
        />
        <span>Email customer</span>
      </label>
      <button
        className="primary-action"
        disabled={state === "busy"}
        type="submit"
      >
        {state === "busy" ? "Saving…" : "Save return update"}
      </button>
      {state === "saved" ? (
        <p className="form-success-inline">Return updated.</p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">Return update failed.</p>
      ) : null}
    </form>
  );
}
