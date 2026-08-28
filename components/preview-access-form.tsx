"use client";

import { useState } from "react";

export function PreviewAccessForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/preview/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      });
      const body = (await response.json()) as { next?: string; error?: string };
      if (!response.ok)
        setError(body.error ?? "Preview access is unavailable.");
      else window.location.assign(body.next ?? "/home");
    } catch {
      setError("Preview access is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="preview-gate__form" onSubmit={submit}>
      <label className="form-field">
        <span>Preview password</span>
        <input
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-action" disabled={busy} type="submit">
        {busy ? "Checking…" : "Enter the private preview"}
      </button>
    </form>
  );
}
