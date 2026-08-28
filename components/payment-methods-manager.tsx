"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreditCard, LockKeyhole } from "lucide-react";

type Method = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

function SetupForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/account/payment-methods`,
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "Card setup could not be completed.");
      setBusy(false);
    } else {
      router.refresh();
      window.setTimeout(() => router.refresh(), 1500);
    }
  }
  return (
    <div className="stripe-payment">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        className="primary-action"
        disabled={!stripe || busy}
        onClick={confirm}
        type="button"
      >
        {busy ? "Saving securely…" : "Save card in TEST MODE"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function PaymentMethodsManager({
  initial,
  enabled,
}: {
  initial: Method[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const stripe = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key?.startsWith("pk_test_") ? loadStripe(key) : null;
  }, []);
  async function start() {
    setError("");
    const response = await fetch("/api/account/payment-methods/setup", {
      method: "POST",
    });
    const body = (await response.json()) as {
      clientSecret?: string;
      error?: string;
    };
    if (response.ok && body.clientSecret) setClientSecret(body.clientSecret);
    else setError(body.error || "Card setup is unavailable.");
  }
  async function remove(id: string) {
    const response = await fetch(`/api/account/payment-methods/${id}`, {
      method: "DELETE",
    });
    if (response.ok) router.refresh();
    else setError("That payment method could not be removed.");
  }
  return (
    <section className="account-panel">
      <div className="panel-heading-with-icon">
        <CreditCard aria-hidden="true" />
        <span>
          <p className="eyebrow">Payment methods</p>
          <h1>Saved cards</h1>
        </span>
      </div>
      <p>
        Card numbers and security codes are handled only by Stripe. Art by
        Elyzaveta stores only brand, last four digits and expiry for display.
      </p>
      {initial.length ? (
        <div className="address-grid">
          {initial.map((method) => (
            <article key={method.id}>
              <strong>
                {method.brand.toUpperCase()} ···· {method.last4}
              </strong>
              <p>
                Expires {String(method.exp_month).padStart(2, "0")}/
                {method.exp_year}
                {method.is_default ? " · Default" : ""}
              </p>
              <button
                className="text-button"
                onClick={() => remove(method.id)}
                type="button"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No saved payment methods</h2>
          <p>
            Saving a card is optional and uses Stripe&apos;s secure TEST MODE
            form.
          </p>
        </div>
      )}
      {enabled && !clientSecret ? (
        <button className="secondary-action" onClick={start} type="button">
          Add a payment method
        </button>
      ) : null}
      {clientSecret && stripe ? (
        <Elements
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#5f6548" },
            },
          }}
          stripe={stripe}
        >
          <SetupForm />
        </Elements>
      ) : null}
      {!enabled ? (
        <div className="payment-availability-note">
          <LockKeyhole aria-hidden="true" />
          <p>
            <strong>
              Saved cards are not enabled during the private preview.
            </strong>
            <br />
            Checkout currently uses the clearly labelled demo flow, and no card
            payment is taken.
          </p>
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
