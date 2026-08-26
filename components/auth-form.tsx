"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot" | "reset";

const messages: Record<Mode, { title: string; submit: string }> = {
  login: { title: "Welcome back", submit: "Sign in" },
  signup: { title: "Create your account", submit: "Create account" },
  forgot: { title: "Reset your password", submit: "Send reset link" },
  reset: { title: "Choose a new password", submit: "Update password" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "success">("idle");
  const [error, setError] = useState("");
  const next = params.get("next")?.startsWith("/")
    ? params.get("next")!
    : "/account";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    setError("");
    const supabase = createClient();

    if (mode === "login") {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (result.error)
        setError("We couldn't sign you in. Check your details and try again.");
      else {
        router.replace(next);
        router.refresh();
        return;
      }
    } else if (mode === "signup") {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (result.error)
        setError(
          "We couldn't create the account. Please review your details and try again.",
        );
      else setStatus("success");
    } else if (mode === "forgot") {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (result.error)
        setError(
          "We couldn't send a reset link right now. Please try again shortly.",
        );
      else setStatus("success");
    } else {
      const result = await supabase.auth.updateUser({ password });
      if (result.error)
        setError(
          "We couldn't update the password. Request a fresh reset link and try again.",
        );
      else {
        setStatus("success");
        window.setTimeout(() => router.replace("/account/security"), 800);
      }
    }
    setStatus((current) => (current === "success" ? "success" : "idle"));
  }

  if (status === "success") {
    return (
      <section className="auth-card" aria-live="polite">
        <p className="eyebrow">Check your inbox</p>
        <h1>{mode === "reset" ? "Password updated" : "One more step"}</h1>
        <p>
          {mode === "signup"
            ? "Use the verification link we sent before signing in."
            : mode === "forgot"
              ? "If an account exists for that address, a secure reset link is on its way."
              : "Your new password is ready."}
        </p>
        <Link className="cta-link" href="/login">
          Continue to sign in
        </Link>
      </section>
    );
  }

  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";
  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">Your Art by Elyzaveta account</p>
      <h1>{messages[mode].title}</h1>
      {mode === "signup" ? (
        <div className="form-grid two-col">
          <label className="form-field">
            <span>First name</span>
            <input
              autoComplete="given-name"
              onChange={(e) => setFirstName(e.target.value)}
              required
              value={firstName}
            />
          </label>
          <label className="form-field">
            <span>Last name</span>
            <input
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
              required
              value={lastName}
            />
          </label>
        </div>
      ) : null}
      {showEmail ? (
        <label className="form-field">
          <span>Email address</span>
          <input
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
      ) : null}
      {showPassword ? (
        <label className="form-field">
          <span>{mode === "reset" ? "New password" : "Password"}</span>
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={10}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
          <small>
            At least 10 characters with upper/lowercase letters and a number.
          </small>
        </label>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="primary-action"
        disabled={status === "busy"}
        type="submit"
      >
        {status === "busy" ? "Please wait…" : messages[mode].submit}
      </button>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/signup">Create an account</Link>
          </>
        ) : null}
        {mode !== "login" ? <Link href="/login">Back to sign in</Link> : null}
      </div>
    </form>
  );
}
