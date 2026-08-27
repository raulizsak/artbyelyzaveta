"use client";

import { useState } from "react";

const SUCCESS =
  "You're on the list. We'll let you know when the shop goes live.";

export function ComingSoonSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "success" | "error">(
    "idle",
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("busy");
    const response = await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setState(response.ok ? "success" : "error");
  }

  if (state === "success")
    return (
      <p className="coming-soon__success" role="status">
        {SUCCESS}
      </p>
    );

  return (
    <form className="coming-soon__form" onSubmit={submit}>
      <label htmlFor="launch-email">Sign up to know when we go live</label>
      <div>
        <input
          autoComplete="email"
          id="launch-email"
          maxLength={320}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          required
          type="email"
          value={email}
        />
        <button disabled={state === "busy"} type="submit">
          {state === "busy" ? "Signing up…" : "Sign up"}
        </button>
      </div>
      {state === "error" ? (
        <p className="form-error" role="alert">
          We couldn&apos;t add you just now. Please try again shortly.
        </p>
      ) : null}
    </form>
  );
}
