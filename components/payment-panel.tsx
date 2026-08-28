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
  paintingIds: string[];
  discountCodes: string[];
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
  mode,
}: {
  email: string;
  sessionId: string;
  mode: "test" | "live";
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
        {busy
          ? "Confirming…"
          : mode === "test"
            ? "Pay securely in test mode"
            : "Pay securely"}
      </button>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StripePaymentPanel({
  amount,
  currency,
  request,
  enabled,
  publishableKey,
  mode,
}: {
  amount: number;
  currency: string;
  request: CheckoutRequest;
  enabled: boolean;
  publishableKey: string;
  mode: "test" | "live";
}) {
  const [clientSecret, setClientSecret] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stripe = useMemo(() => {
    const prefix = mode === "live" ? "pk_live_" : "pk_test_";
    return publishableKey.startsWith(prefix) ? loadStripe(publishableKey) : null;
  }, [mode, publishableKey]);

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
        <p className="eyebrow">
          {mode === "test" ? "Stripe test mode" : "Secure checkout"}
        </p>
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
            Secure checkout is temporarily unavailable. No order will be
            created.
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
            {busy
              ? "Reserving artwork…"
              : mode === "test"
                ? "Continue to test payment"
                : "Continue to secure payment"}
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
            <PaymentForm
              email={request.email}
              mode={mode}
              sessionId={sessionId}
            />
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function placeDemoOrder() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/checkout/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = (await response.json()) as {
      reference?: string;
      guestToken?: string | null;
      error?: string;
    };
    if (!response.ok || !body.reference) {
      setError(body.error || "The demo order could not be placed.");
      setBusy(false);
      return;
    }
    const query = new URLSearchParams({ reference: body.reference });
    if (body.guestToken) query.set("token", body.guestToken);
    router.push(`/order-confirmation?${query.toString()}`);
  }

  return (
    <section aria-labelledby="payment-heading" className="mock-payment-panel">
      <LockKeyhole aria-hidden="true" size={24} strokeWidth={1.5} />
      <div className="payment-panel__body">
        <p className="eyebrow">Demo checkout</p>
        <h3 id="payment-heading">No payment will be taken</h3>
        <p>
          This creates a real test order and sends the normal customer and shop
          emails, without asking for card details or contacting Stripe.
        </p>
        <p className="mock-payment-panel__amount">
          Demo total: <strong>{formatMoney(amount, currency)}</strong>
        </p>
        {!enabled ? (
          <p className="form-help">
            Demo checkout is currently disabled. No order will be created.
          </p>
        ) : (
          <button
            className="mock-confirm"
            disabled={busy}
            onClick={placeDemoOrder}
            type="button"
          >
            <ShieldCheck aria-hidden="true" size={17} />
            {busy ? "Placing demo order…" : "Place demo order"}
          </button>
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
