"use client";

import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/catalog";

export type CheckoutRequest = {
  paintingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  delivery: "shipping" | "collection";
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  notes: string;
};

function PaymentForm({
  email,
  sessionId,
}: {
  email: string;
  sessionId: string;
}) {
  const router = useRouter();
  const result = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (result.type !== "success") return;
    setBusy(true);
    setError("");
    const confirmation = await result.checkout.confirm({
      email,
      redirect: "if_required",
      returnUrl: `${window.location.origin}/order-confirmation?session_id=${encodeURIComponent(sessionId)}`,
    });
    if (confirmation.type === "error") {
      setError(
        confirmation.error.message ||
          "Payment could not be completed. Please review your details.",
      );
      setBusy(false);
      return;
    }
    router.push(
      `/order-confirmation?session_id=${encodeURIComponent(sessionId)}`,
    );
  }

  return (
    <div className="stripe-payment">
      <PaymentElement />
      <button
        className="mock-confirm"
        disabled={busy || result.type !== "success"}
        onClick={confirm}
        type="button"
      >
        <ShieldCheck aria-hidden="true" size={17} />
        {busy ? "Confirming…" : "Pay securely in TEST MODE"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PaymentPanel({
  amount,
  currency,
  request,
  enabled,
}: {
  amount: number;
  currency: string;
  request: CheckoutRequest;
  enabled: boolean;
}) {
  const [clientSecret, setClientSecret] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stripe = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key?.startsWith("pk_test_") ? loadStripe(key) : null;
  }, []);

  async function prepare() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = (await response.json()) as {
      clientSecret?: string;
      sessionId?: string;
      error?: string;
    };
    if (!response.ok || !body.clientSecret || !body.sessionId)
      setError(body.error || "Secure payment could not be prepared.");
    else {
      setClientSecret(body.clientSecret);
      setSessionId(body.sessionId);
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="payment-heading" className="mock-payment-panel">
      <LockKeyhole aria-hidden="true" size={24} strokeWidth={1.5} />
      <div className="payment-panel__body">
        <p className="eyebrow">Stripe TEST MODE</p>
        <h3 id="payment-heading">Secure card payment</h3>
        <p>
          Card details are entered directly into Stripe and are never stored by
          Art by Elyzaveta.
        </p>
        <p className="mock-payment-panel__amount">
          Total: <strong>{formatMoney(amount, currency)}</strong>
        </p>
        {!enabled ? (
          <p className="form-help">
            Test checkout is safely disabled until the connected Stripe test
            keys are configured. No order will be created.
          </p>
        ) : null}
        {enabled && !clientSecret ? (
          <button
            className="mock-confirm"
            disabled={busy}
            onClick={prepare}
            type="button"
          >
            <ShieldCheck aria-hidden="true" size={17} />
            {busy ? "Reserving artwork…" : "Continue to test payment"}
          </button>
        ) : null}
        {clientSecret && stripe ? (
          <CheckoutElementsProvider
            options={{
              clientSecret,
              elementsOptions: {
                appearance: {
                  theme: "stripe",
                  variables: { colorPrimary: "#5f6548", borderRadius: "7px" },
                },
              },
            }}
            stripe={stripe}
          >
            <PaymentForm email={request.email} sessionId={sessionId} />
          </CheckoutElementsProvider>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
