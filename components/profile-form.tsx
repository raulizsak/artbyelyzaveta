"use client";

import { useState } from "react";

export function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
}) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setState(response.ok ? "saved" : "error");
  }
  return (
    <form className="account-panel" onSubmit={submit}>
      <p className="eyebrow">Profile</p>
      <h1>Your details</h1>
      <div className="form-grid two-col">
        <label className="form-field">
          <span>First name</span>
          <input
            onChange={(e) =>
              setValues({ ...values, firstName: e.target.value })
            }
            required
            value={values.firstName}
          />
        </label>
        <label className="form-field">
          <span>Last name</span>
          <input
            onChange={(e) => setValues({ ...values, lastName: e.target.value })}
            required
            value={values.lastName}
          />
        </label>
        <label className="form-field">
          <span>Phone</span>
          <input
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
            type="tel"
            value={values.phone}
          />
        </label>
        <label className="form-field">
          <span>Verified email</span>
          <input disabled value={values.email} />
          <small>
            Email changes use Supabase&apos;s secure verification flow.
          </small>
        </label>
      </div>
      <button
        className="primary-action"
        disabled={state === "busy"}
        type="submit"
      >
        {state === "busy" ? "Saving…" : "Save profile"}
      </button>
      {state === "saved" ? (
        <p className="form-success-inline">Profile saved.</p>
      ) : null}
      {state === "error" ? (
        <p className="form-error">We couldn&apos;t save your profile.</p>
      ) : null}
    </form>
  );
}
