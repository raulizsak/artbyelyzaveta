"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

export function PasswordChangeForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("idle");
    if (!strongPassword.test(newPassword)) {
      setMessage(
        "Use at least 10 characters with upper and lowercase letters and a number.",
      );
      setState("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      setState("error");
      return;
    }
    if (currentPassword === newPassword) {
      setMessage(
        "Choose a new password that is different from the current one.",
      );
      setState("error");
      return;
    }

    setState("busy");
    const supabase = createClient();
    const authenticated = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (authenticated.error) {
      setMessage("The current password is not correct.");
      setState("error");
      return;
    }
    const changed = await supabase.auth.updateUser({ password: newPassword });
    if (changed.error) {
      setMessage("We couldn't change the password. Please try again.");
      setState("error");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(
      "Password changed. If you use two-step verification, verify a fresh code before returning to admin.",
    );
    setState("saved");
  }

  return (
    <section className="account-panel security-password-panel">
      <div className="panel-heading-with-icon">
        <LockKeyhole aria-hidden="true" />
        <span>
          <p className="eyebrow">Password</p>
          <h2>Change your password</h2>
        </span>
      </div>
      <p>Confirm your current password, then choose a strong replacement.</p>
      <form className="password-change-form" onSubmit={submit}>
        <label className="form-field">
          <span>Current password</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <div className="form-grid two-col">
          <label className="form-field">
            <span>New password</span>
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input
              autoComplete="new-password"
              minLength={10}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
        </div>
        <p className="form-help">
          At least 10 characters, including upper and lowercase letters and a
          number.
        </p>
        <button
          className="primary-action"
          disabled={state === "busy"}
          type="submit"
        >
          {state === "busy" ? "Changing…" : "Change password"}
        </button>
        {state === "saved" ? (
          <p className="form-success-inline" role="status">
            {message}
          </p>
        ) : null}
        {state === "error" ? (
          <p className="form-error" role="alert">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
