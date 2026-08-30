"use client";

import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import { LockKeyhole, Paintbrush, Palette, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
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
  amount,
  currency,
  email,
  sessionId,
  mode,
}: {
  amount: number;
  currency: string;
  email: string;
  sessionId: string;
  mode: "test" | "live";
}) {
  const router = useRouter();
  const result = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const confirming = useRef(false);
  const checkout = result.type === "success" ? result.checkout : null;
  const confirmationPath = `/order-confirmation?session_id=${encodeURIComponent(sessionId)}`;
  const totalMismatch =
    checkout !== null &&
    (checkout.total.total.minorUnitsAmount !== amount ||
      checkout.currency.toLowerCase() !== currency.toLowerCase());
  const expired = checkout?.status.type === "expired";

  async function confirm() {
    if (!checkout || confirming.current || totalMismatch || expired) return;
    confirming.current = true;
    setBusy(true);
    setError("");
    setSlow(false);
    setUncertain(false);
    const slowTimer = window.setTimeout(() => setSlow(true), 15000);
    let succeeded = false;
    try {
      const confirmation = await checkout.confirm({
        email,
        redirect: "if_required",
        returnUrl: `${window.location.origin}${confirmationPath}`,
      });
      if (confirmation.type === "error") {
        setError(
          confirmation.error.message ||
            "Payment could not be completed. Please review your details.",
        );
        return;
      }
      succeeded = true;
      setConfirmed(true);
      router.push(confirmationPath);
    } catch {
      // An SDK/network exception doesn't prove that payment failed.
      setUncertain(true);
      setError(
        "We couldn't confirm the payment result. Please check your order status before trying again.",
      );
    } finally {
      window.clearTimeout(slowTimer);
      confirming.current = succeeded;
      setBusy(false);
      setSlow(false);
    }
  }

  return (
    <div className="stripe-payment">
      {checkout ? (
        <>
          <PaymentElement />
          <p className="stripe-payment__total" aria-live="polite">
            {/* Stripe requires its own reactive total to be displayed before confirm(). */}
            Total to pay: <strong>{checkout.total.total.amount}</strong>
          </p>
        </>
      ) : result.type === "error" ? (
        <p className="form-error" role="alert">
          {result.error.message || "Secure payment could not be loaded."}
        </p>
      ) : (
        <p className="form-help" role="status">
          Loading secure payment…
        </p>
      )}
      {totalMismatch || expired ? (
        <p className="form-error" role="alert">
          {expired
            ? "This payment session has expired. Please return to your bag and start checkout again."
            : "The payment total has changed. Please return to your bag and review your order before paying."}{" "}
          <a href="/cart">Return to your bag</a>
        </p>
      ) : null}
      <button
        className="mock-confirm"
        disabled={busy || confirmed || !checkout || totalMismatch || expired}
        onClick={confirm}
        type="button"
      >
        <span aria-hidden="true" className="pay-art-icons">
          <Paintbrush size={16} />
          <Palette size={16} />
        </span>
        {busy
          ? "Confirming…"
          : confirmed
            ? "Opening confirmation…"
            : mode === "test"
              ? "Pay securely in test mode"
              : "Pay securely"}
      </button>
      <p className="payment-security-note">
        <LockKeyhole aria-hidden="true" size={14} />
        Payments are processed securely by Stripe. Art by Elyzaveta never sees
        or stores your card details.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {slow || uncertain ? (
        <p className="form-help" role="status">
          {slow
            ? "Stripe is taking longer than usual. Please complete any bank verification and avoid submitting another payment. "
            : "Your payment may still be processing. "}
          <a href={confirmationPath}>Check order status</a>
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
  const preparing = useRef(false);
  const stripe = useMemo(() => {
    const prefix = mode === "live" ? "pk_live_" : "pk_test_";
    return publishableKey.startsWith(prefix)
      ? loadStripe(publishableKey).catch(() => null)
      : null;
  }, [mode, publishableKey]);

  async function prepare() {
    if (preparing.current || !stripe) return;
    preparing.current = true;
    setBusy(true);
    setError("");
    try {
      const stripeClient = await stripe;
      if (!stripeClient) throw new Error("stripe-unavailable");
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
    } catch {
      setError(
        "Secure payment could not be loaded. Please check your connection and try again. No payment has been submitted.",
      );
    } finally {
      preparing.current = false;
      setBusy(false);
    }
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
        {mode === "test" ? (
          <p>
            Test payments only. Use card 4242 4242 4242 4242 with any future
            expiry and any three-digit CVC. Do not enter real card details.
          </p>
        ) : null}
        {!enabled ? (
          <p className="form-help">
            Secure checkout is temporarily unavailable. No order will be
            created.
          </p>
        ) : null}
        {enabled && !stripe ? (
          <p className="form-error" role="alert">
            Secure payment is temporarily unavailable. Please try again later.
          </p>
        ) : null}
        {enabled && !clientSecret && stripe ? (
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
                  variables: {
                    colorPrimary: "#5f6548",
                    colorBackground: "#fffdf8",
                    colorText: "#23261f",
                    colorDanger: "#9a403a",
                    colorTextSecondary: "#6d6b61",
                    fontFamily: "Arial, sans-serif",
                    borderRadius: "7px",
                    spacingUnit: "4px",
                  },
                  rules: {
                    ".Input": {
                      border: "1px solid #d9ceb8",
                      boxShadow: "none",
                    },
                    ".Input:focus": {
                      border: "1px solid #5f6548",
                      boxShadow: "0 0 0 1px #5f6548",
                    },
                    ".Label": { color: "#4d5143", fontWeight: "500" },
                  },
                },
              },
            }}
            stripe={stripe}
          >
            <PaymentForm
              amount={amount}
              currency={currency}
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
