"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function NotificationReconciliation({ id }: { id: string }) {
  const [resolution, setResolution] = useState("sent");
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <details>
      <summary>Reconcile delivery</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/admin/notifications/" + id, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify({ resolution, note, providerId, verified }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                result.error || "Reconciliation could not be saved.",
              );
            setNote("");
            setVerified(false);
            router.refresh();
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Check SMTP2GO activity first. Retrying an accepted message can send it
          twice.
        </p>
        <label className="form-field">
          <span>Outcome</span>
          <select
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
          >
            <option value="sent">Provider confirms accepted</option>
            <option value="retry">
              Provider confirms not accepted — retry
            </option>
            <option value="cancelled">Cancel this notification</option>
          </select>
        </label>
        {resolution === "sent" ? (
          <label className="form-field">
            <span>Provider evidence ID</span>
            <input
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              required
              maxLength={200}
            />
          </label>
        ) : null}
        <label className="form-field">
          <span>Reconciliation note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            minLength={10}
            maxLength={500}
            required
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
            required
          />{" "}
          I checked the provider delivery records.
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="secondary-action"
          disabled={busy || !verified}
        >
          {busy ? "Saving…" : "Apply reconciliation"}
        </button>
      </form>
    </details>
  );
}
