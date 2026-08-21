"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Mail, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type DemoOrder = {
  reference: string;
  firstName: string;
  email: string;
  delivery: string;
  title: string;
  total: number;
};
export function OrderConfirmation() {
  const params = useSearchParams();
  const [order, setOrder] = useState<DemoOrder | null>(null);
  useEffect(() => {
    const value = window.sessionStorage.getItem("art-by-elyzaveta-demo-order");
    // The confirmation is deliberately browser-local in demo mode.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value) setOrder(JSON.parse(value) as DemoOrder);
  }, []);
  const reference = order?.reference ?? params.get("reference");
  return (
    <section className="confirmation-card">
      <div className="confirmation-mark">
        <Check aria-hidden="true" />
      </div>
      <p className="eyebrow">Demonstration complete</p>
      <h1>Thank you{order?.firstName ? `, ${order.firstName}` : ""}.</h1>
      <p className="confirmation-lede">
        Your demo order has been created locally. No artwork has been reserved,
        no message has been sent and no payment has been taken.
      </p>
      {reference ? (
        <p className="order-reference">
          Demo reference <strong>{reference}</strong>
        </p>
      ) : null}
      <div className="confirmation-next">
        <div>
          <Mail aria-hidden="true" />
          <p>
            <strong>In a live store</strong>
            <br />
            An order email would be sent to {order?.email ?? "your address"}.
          </p>
        </div>
        <div>
          <Sparkles aria-hidden="true" />
          <p>
            <strong>For this demonstration</strong>
            <br />
            Return to the painting or enquire directly with the artist.
          </p>
        </div>
      </div>
      <div className="button-row">
        <Link className="cta-link" href="/shop/cows-at-dusk">
          Return to the painting
        </Link>
        <Link className="secondary-action" href="/contact">
          Contact the artist
        </Link>
      </div>
    </section>
  );
}
