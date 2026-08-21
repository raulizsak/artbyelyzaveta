"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";

export type PaymentPanelProps = {
  amount: number;
  currency: string;
  disabled?: boolean;
  onComplete: () => void;
};

export function MockPaymentPanel({
  amount,
  currency,
  disabled,
  onComplete,
}: PaymentPanelProps) {
  return (
    <section aria-labelledby="payment-heading" className="mock-payment-panel">
      <LockKeyhole aria-hidden="true" size={24} strokeWidth={1.5} />
      <div>
        <p className="eyebrow">Demo mode</p>
        <h3 id="payment-heading">No payment is collected</h3>
        <p>
          This Phase 1 store does not request, store or transmit card or bank
          details. The button below only creates a local demonstration
          confirmation.
        </p>
        <p className="mock-payment-panel__amount">
          Demonstration total:{" "}
          <strong>
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency,
              maximumFractionDigits: 0,
            }).format(amount / 100)}
          </strong>
        </p>
      </div>
      <button
        className="mock-confirm"
        disabled={disabled}
        onClick={onComplete}
        type="button"
      >
        <ShieldCheck aria-hidden="true" size={17} /> Place demo order
      </button>
    </section>
  );
}

export const PaymentPanel = MockPaymentPanel;
