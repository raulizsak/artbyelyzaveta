import type { Metadata } from "next";
import Link from "next/link";
import { Check, Mail, Sparkles } from "lucide-react";
import { ClearPurchasedCart } from "@/components/clear-purchased-cart";
import { formatMoney } from "@/lib/catalog";
import {
  getOrderForConfirmation,
  getOrderForStripeSession,
} from "@/lib/orders/confirmation";

export const metadata: Metadata = { title: "Order confirmation" };
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; session_id?: string; token?: string }>;
}) {
  const query = await searchParams;
  const order = query.session_id
    ? await getOrderForStripeSession(query.session_id)
    : query.reference
      ? await getOrderForConfirmation({
        reference: query.reference,
        token: query.token,
      })
      : null;
  return (
    <main className="confirmation-page shell" id="main-content">
      {!order ? (
        <section className="confirmation-card">
          <p className="eyebrow">Private order access</p>
          <h1>We couldn&apos;t find an order you&apos;re allowed to view.</h1>
          <p>
            Check the link from your confirmation email or sign in to your
            account.
          </p>
          <Link className="cta-link" href="/login">
            Sign in
          </Link>
        </section>
      ) : (
        <section className="confirmation-card">
          <ClearPurchasedCart />
          <div className="confirmation-mark">
            <Check aria-hidden="true" />
          </div>
          <p className="eyebrow">
            {order.isDemo
              ? "Demo order confirmed"
              : order.paymentStatus === "paid"
                ? "Payment confirmed"
                : "Payment processing"}
          </p>
          <h1>Thank you, {order.firstName}.</h1>
          <p className="confirmation-lede">
            {order.isDemo
              ? "Your demo order is confirmed. No payment was taken. Elyzaveta will contact you about the delivery arrangement."
              : order.paymentStatus === "paid"
                ? "Your order is confirmed. Elyzaveta will contact you about the delivery arrangement."
                : "Stripe has returned you safely. We are waiting for the signed payment confirmation before marking the artwork as sold."}
          </p>
          <p className="order-reference">
            Order <strong>{order.reference}</strong> ·{" "}
            {formatMoney(order.totalCents, order.currency)}
          </p>
          <div className="confirmation-next">
            <div>
              <Mail aria-hidden="true" />
              <p>
                <strong>Confirmation email</strong>
                <br />A confirmation and private order link will be sent to{" "}
                {order.email} after payment is confirmed.
              </p>
            </div>
            <div>
              <Sparkles aria-hidden="true" />
              <p>
                <strong>{order.item?.title ?? "Original artwork"}</strong>
                <br />
                {order.deliveryMethod === "collection"
                  ? "Collection details will be arranged personally."
                  : "Shipping and timing will be confirmed personally."}
              </p>
            </div>
          </div>
          <div className="button-row">
            {order.item ? (
              <Link
                className="cta-link"
                href={`/shop/${order.item.paintingSlug}`}
              >
                View the painting
              </Link>
            ) : null}
            <Link className="secondary-action" href="/signup">
              Create an account to track your order, access invoices and request
              a return more easily
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
