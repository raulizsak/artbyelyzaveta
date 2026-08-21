"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type ContactValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
  consent: boolean;
};
type RequiredField = "name" | "email" | "message" | "consent";
type ErrorMap = Partial<Record<RequiredField, string>>;

const empty: ContactValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
  consent: false,
};
const validate = (values: ContactValues): ErrorMap => {
  const errors: ErrorMap = {};
  if (!values.name.trim()) errors.name = "Please enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(values.email))
    errors.email = "Please enter a valid email address.";
  if (!values.message.trim()) errors.message = "Please enter your message.";
  if (!values.consent)
    errors.consent =
      "Please confirm that we can use these details to respond to your enquiry.";
  return errors;
};

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const submit = useMutation(api.enquiries.submitContact);
  const [form, setForm] = useState<ContactValues>(empty);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [shaking, setShaking] = useState<RequiredField[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    formRef.current?.setAttribute("data-ready", "true");
    return () => {
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const update = (key: keyof ContactValues, value: string | boolean) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted && key in errors) {
      const nextErrors = validate(next);
      setErrors((current) => {
        if (nextErrors[key as RequiredField]) return current;
        const updated = { ...current };
        delete updated[key as RequiredField];
        return updated;
      });
    }
    if (state === "error") setState("idle");
  };

  const triggerErrors = (nextErrors: ErrorMap) => {
    const fields = Object.keys(nextErrors) as RequiredField[];
    setErrors(nextErrors);
    setSubmitted(true);
    setShaking(fields);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setShaking([]), 330);
    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${fields[0]}"]`)
        ?.focus();
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === "sending") return;
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      triggerErrors(nextErrors);
      return;
    }
    setErrors({});
    setFormError("");
    setState("sending");
    try {
      await submit(form);
      setForm(empty);
      setSubmitted(false);
      setState("success");
    } catch {
      setState("error");
      setFormError(
        "Your message could not be saved. Please try again or use the email address beside the form.",
      );
    }
  };

  const errorMessage = (key: RequiredField) =>
    errors[key] ? (
      <small className="field-error" id={`contact-${key}-error`}>
        <CircleAlert aria-hidden="true" size={14} /> {errors[key]}
      </small>
    ) : null;

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
        <label
          className={cn(
            "form-field",
            errors.name && "form-field--invalid",
            shaking.includes("name") && "form-field--shake",
          )}
          htmlFor="contact-name"
        >
          <span>Name *</span>
          <input
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            aria-invalid={errors.name ? "true" : undefined}
            autoComplete="name"
            id="contact-name"
            name="name"
            onChange={(event) => update("name", event.target.value)}
            placeholder="Full name"
            value={form.name}
          />
          {errorMessage("name")}
        </label>
        <label
          className={cn(
            "form-field",
            errors.email && "form-field--invalid",
            shaking.includes("email") && "form-field--shake",
          )}
          htmlFor="contact-email"
        >
          <span>Email *</span>
          <input
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            aria-invalid={errors.email ? "true" : undefined}
            autoComplete="email"
            id="contact-email"
            name="email"
            onChange={(event) => update("email", event.target.value)}
            placeholder="name@example.com"
            type="email"
            value={form.email}
          />
          {errorMessage("email")}
        </label>
        <label
          className="form-field form-field--wide"
          htmlFor="contact-subject"
        >
          <span>Subject</span>
          <select
            className={!form.subject ? "select-placeholder" : undefined}
            id="contact-subject"
            name="subject"
            onChange={(event) => update("subject", event.target.value)}
            value={form.subject}
          >
            <option value="">Choose a subject</option>
            <option>Available painting</option>
            <option>Shipping or delivery</option>
            <option>Commission</option>
            <option>General enquiry</option>
            <option>Other</option>
          </select>
        </label>
        <label
          className={cn(
            "form-field form-field--wide",
            errors.message && "form-field--invalid",
            shaking.includes("message") && "form-field--shake",
          )}
          htmlFor="contact-message"
        >
          <span>Message *</span>
          <textarea
            aria-describedby={
              errors.message ? "contact-message-error" : undefined
            }
            aria-invalid={errors.message ? "true" : undefined}
            id="contact-message"
            name="message"
            onChange={(event) => update("message", event.target.value)}
            placeholder="How can we help?"
            rows={7}
            value={form.message}
          />
          {errorMessage("message")}
        </label>
        <div
          className={cn(
            "consent-group form-field--wide",
            errors.consent && "form-field--invalid",
            shaking.includes("consent") && "form-field--shake",
          )}
        >
          <label className="consent-field" htmlFor="contact-consent">
            <input
              aria-describedby={
                errors.consent ? "contact-consent-error" : undefined
              }
              aria-invalid={errors.consent ? "true" : undefined}
              checked={form.consent}
              id="contact-consent"
              name="consent"
              onChange={(event) => update("consent", event.target.checked)}
              type="checkbox"
            />
            <span>
              I consent to Art by Elyzaveta using these details to respond to my
              enquiry. *
            </span>
          </label>
          {errorMessage("consent")}
        </div>
      </div>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button
        className="primary-action"
        disabled={state === "sending"}
        type="submit"
      >
        {state === "sending" ? (
          <LoaderCircle
            aria-hidden="true"
            className="upload-spinner"
            size={17}
          />
        ) : (
          <Send aria-hidden="true" size={17} />
        )}
        {state === "sending" ? "Sending enquiry…" : "Send enquiry"}
      </button>
    </form>
  );
}
