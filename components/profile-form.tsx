"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";

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
      <div className="panel-heading-with-icon">
        <UserRound aria-hidden="true" />
        <span>
          <p className="eyebrow">Profile</p>
          <h1>Your details</h1>
        </span>
      </div>
      <p className="account-panel__intro">
        Keep your contact details current for delivery updates and studio
        correspondence.
      </p>
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
          <small className="neutral-helper">
            Verified and protected by secure email confirmation.
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
        <p className="form-success-inline" role="status">
          Your profile has been saved.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="form-error" role="alert">
          We couldn&apos;t save your profile.
        </p>
      ) : null}
    </form>
  );
}
