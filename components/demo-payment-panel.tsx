"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CheckoutRequest } from "@/components/payment-panel";
import { formatMoney } from "@/lib/catalog";

export function DemoPaymentPanel({
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
    try {
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
    } catch {
      setError("The demo order could not be placed. Please try again.");
      setBusy(false);
    }
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
