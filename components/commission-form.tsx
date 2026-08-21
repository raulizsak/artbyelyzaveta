"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";

const empty = {
  name: "",
  email: "",
  phone: "",
  subject: "Landscape commission",
  inspiration: "",
  dimensions: "",
  budget: "",
  timing: "",
  notes: "",
  consent: false,
};
export function CommissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useMutation(api.enquiries.submitCommission);
  const [form, setForm] = useState(empty);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    formRef.current?.setAttribute("data-ready", "true");
  }, []);
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !/^\S+@\S+\.\S+$/.test(form.email) ||
      !form.inspiration.trim() ||
      !form.consent
    ) {
      setError("Please complete your name, email, inspiration and consent.");
      return;
    }
    setState("sending");
    setError("");
    try {
      await submit(form);
      setState("success");
      setForm(empty);
    } catch {
      setState("error");
      setError(
        "Your enquiry could not be saved. Please try again or contact the artist by email.",
      );
    }
  };
  if (state === "success")
    return (
      <section className="form-success" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="eyebrow">Enquiry received</p>
        <h2>Your idea is on its way.</h2>
        <p>
          Thank you. Elyzaveta will review the details and respond personally
          about fit and availability.
        </p>
        <button
          className="text-button"
          onClick={() => setState("idle")}
          type="button"
        >
          Start another enquiry
        </button>
      </section>
    );
  const input = (key: keyof typeof form, label: string, required = false) => (
    <label className="form-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        onChange={(e) => set(key, e.target.value)}
        value={String(form[key])}
      />
    </label>
  );
  return (
    <form className="enquiry-form" noValidate onSubmit={onSubmit} ref={formRef}>
      <div className="form-grid two-col">
        {input("name", "Name", true)}
        <label className="form-field">
          <span>Email *</span>
          <input
            onChange={(e) => set("email", e.target.value)}
            type="email"
            value={form.email}
          />
        </label>
        {input("phone", "Phone")}
        {input("subject", "Subject")}
        {input("dimensions", "Approximate dimensions")}
        {input("budget", "Indicative budget")}
        {input("timing", "Preferred timing")}
        <label className="form-field form-field--wide">
          <span>Inspiration / story *</span>
          <textarea
            onChange={(e) => set("inspiration", e.target.value)}
            placeholder="Describe the place, memory, colours or feeling you would like the painting to hold."
            rows={7}
            value={form.inspiration}
          />
        </label>
        <label className="form-field form-field--wide">
          <span>Anything else?</span>
          <textarea
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            value={form.notes}
          />
        </label>
        <label className="consent-field form-field--wide">
          <input
            checked={form.consent}
            onChange={(e) => set("consent", e.target.checked)}
            type="checkbox"
          />
          <span>
            I consent to Art by Elyzaveta using these details to respond to my
            commission enquiry. *
          </span>
        </label>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="primary-action"
        disabled={state === "sending"}
        type="submit"
      >
        <Send aria-hidden="true" size={17} />{" "}
        {state === "sending" ? "Saving…" : "Send commission enquiry"}
      </button>
    </form>
  );
}
