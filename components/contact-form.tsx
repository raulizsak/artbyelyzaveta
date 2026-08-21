"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";

const empty = {
  name: "",
  email: "",
  subject: "Artwork enquiry",
  message: "",
  consent: false,
};
export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useMutation(api.enquiries.submitContact);
  const [form, setForm] = useState(empty);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    formRef.current?.setAttribute("data-ready", "true");
  }, []);
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !/^\S+@\S+\.\S+$/.test(form.email) ||
      !form.message.trim() ||
      !form.consent
    ) {
      setError("Please complete every required field and confirm consent.");
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
        "Your message could not be saved. Please try again or use the email address beside the form.",
      );
    }
  };
  if (state === "success")
    return (
      <section className="form-success" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="eyebrow">Enquiry received</p>
        <h2>Thank you for reaching out.</h2>
        <p>
          Your message has been saved securely. Elyzaveta will respond
          personally.
        </p>
        <button
          className="text-button"
          onClick={() => setState("idle")}
          type="button"
        >
          Send another message
        </button>
      </section>
    );
  return (
    <form className="enquiry-form" noValidate onSubmit={onSubmit} ref={formRef}>
      <div className="form-grid two-col">
        <label className="form-field">
          <span>Name *</span>
          <input
            autoComplete="name"
            onChange={(e) =>
              setForm((current) => ({ ...current, name: e.target.value }))
            }
            value={form.name}
          />
        </label>
        <label className="form-field">
          <span>Email *</span>
          <input
            autoComplete="email"
            onChange={(e) =>
              setForm((current) => ({ ...current, email: e.target.value }))
            }
            type="email"
            value={form.email}
          />
        </label>
        <label className="form-field form-field--wide">
          <span>Subject</span>
          <select
            onChange={(e) =>
              setForm((current) => ({ ...current, subject: e.target.value }))
            }
            value={form.subject}
          >
            <option>Artwork enquiry</option>
            <option>Delivery question</option>
            <option>Commission enquiry</option>
            <option>General enquiry</option>
          </select>
        </label>
        <label className="form-field form-field--wide">
          <span>Message *</span>
          <textarea
            onChange={(e) =>
              setForm((current) => ({ ...current, message: e.target.value }))
            }
            rows={7}
            value={form.message}
          />
        </label>
        <label className="consent-field form-field--wide">
          <input
            checked={form.consent}
            onChange={(e) =>
              setForm((current) => ({ ...current, consent: e.target.checked }))
            }
            type="checkbox"
          />
          <span>
            I consent to Art by Elyzaveta using these details to respond to my
            enquiry. *
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
        {state === "sending" ? "Saving…" : "Send enquiry"}
      </button>
    </form>
  );
}
