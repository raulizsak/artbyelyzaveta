"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AnimatedStepper from "@/components/smoothui/animated-stepper";
import { useCart } from "@/components/cart-provider";
import { DemoPaymentPanel } from "@/components/demo-payment-panel";
import { StripePaymentPanel } from "@/components/payment-panel";
import { formatMoney, paintingDimensions } from "@/lib/catalog";

type Details = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  notes: string;
};

type Quote = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  discounts: { code: string; appliedCents: number }[];
};

const initial: Details = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  suburb: "",
  state: "VIC",
  postcode: "",
  country: "Australia",
  notes: "",
};

export function CheckoutClient({
  checkoutEnabled,
  paymentMode,
  stripePublishableKey = "",
  initialDetails,
}: {
  checkoutEnabled: boolean;
  paymentMode: "demo" | "test" | "live";
  stripePublishableKey?: string;
  initialDetails?: Partial<Details>;
}) {
  const checkoutRef = useRef<HTMLElement>(null);
  const cart = useCart();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ ...initial, ...initialDetails });
  const [delivery, setDelivery] = useState<"shipping" | "collection">(
    "shipping",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [discountEntry, setDiscountEntry] = useState("");
  const [discountCodes, setDiscountCodes] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem("art-by-elyzaveta-checkout");
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDetails(JSON.parse(stored) as Details);
      } catch {
        window.sessionStorage.removeItem("art-by-elyzaveta-checkout");
      }
    }
    const frame = window.requestAnimationFrame(() => {
      checkoutRef.current?.setAttribute("data-checkout-ready", "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    window.sessionStorage.setItem(
      "art-by-elyzaveta-checkout",
      JSON.stringify(details),
    );
  }, [details]);

  const update = (field: keyof Details, value: string) =>
    setDetails((current) => ({ ...current, [field]: value }));
  const validateDetails = () => {
    const next: Record<string, string> = {};
    if (!details.firstName.trim()) next.firstName = "Enter your first name.";
    if (!details.lastName.trim()) next.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(details.email))
      next.email = "Enter a valid email address.";
    if (!details.phone.trim()) next.phone = "Enter a contact phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const validateDelivery = () => {
    if (delivery === "collection") {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    if (!details.address.trim()) next.address = "Enter a street address.";
    if (!details.suburb.trim()) next.suburb = "Enter a suburb or city.";
    if (!details.postcode.trim()) next.postcode = "Enter a postcode.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function refreshQuote(codes: string[]) {
    setQuoteBusy(true);
    setQuoteError("");
    const response = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paintingIds: cart.items.map((item) => item.id),
        delivery,
        discountCodes: codes,
        email: details.email,
      }),
    });
    const body = (await response.json()) as Quote & { error?: string };
    setQuoteBusy(false);
    if (!response.ok) {
      setQuoteError(body.error || "The order total couldn't be refreshed.");
      return false;
    }
    setQuote(body);
    return true;
  }

  const advance = async () => {
    if (step === 0 && !validateDetails()) return;
    if (step === 1) {
      if (!validateDelivery()) return;
      if (!(await refreshQuote(discountCodes))) return;
    }
    setStep((current) => Math.min(2, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function applyDiscount() {
    const code = discountEntry.trim().toUpperCase();
    if (!code || discountCodes.includes(code)) return;
    const next = [...discountCodes, code];
    if (await refreshQuote(next)) {
      setDiscountCodes(next);
      setDiscountEntry("");
    }
  }

  async function removeDiscount(code: string) {
    const next = discountCodes.filter((entry) => entry !== code);
    if (await refreshQuote(next)) setDiscountCodes(next);
  }

  const field = (
    name: keyof Details,
    label: string,
    type = "text",
    autocomplete?: string,
  ) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        aria-invalid={!!errors[name]}
        autoComplete={autocomplete}
        name={name}
        onChange={(event) => update(name, event.target.value)}
        type={type}
        value={details[name]}
      />
      {errors[name] ? <small id={`${name}-error`}>{errors[name]}</small> : null}
    </label>
  );

  const item = cart.items[0];
  if (!item)
    return (
      <div className="empty-state checkout-empty">
        <p className="eyebrow">Checkout</p>
        <h1>Your bag is empty.</h1>
        <p>Add an available original before entering the checkout.</p>
        <Link className="cta-link" href="/shop">
          Return to the collection
        </Link>
      </div>
    );

  const displayed =
    quote ??
    ({
      subtotalCents: cart.subtotal,
      discountCents: 0,
      shippingCents:
        delivery === "shipping"
          ? cart.items.reduce((sum, entry) => sum + entry.shippingCents, 0)
          : 0,
      totalCents:
        cart.subtotal +
        (delivery === "shipping"
          ? cart.items.reduce((sum, entry) => sum + entry.shippingCents, 0)
          : 0),
      currency: item.currency,
      discounts: [],
    } satisfies Quote);
  const request = {
    paintingIds: cart.items.map((entry) => entry.id),
    discountCodes,
    ...details,
    delivery,
  };

  return (
    <>
      <header className="checkout-header">
        <div>
          <p className="eyebrow">
            {paymentMode === "test" ? "Secure checkout · Test mode" : "Secure checkout"}
          </p>
          <h1>Checkout</h1>
        </div>
        <p>{paymentMode === "demo" ? "No payment will be taken." : "Payments protected by Stripe."}</p>
      </header>
      <AnimatedStepper
        className="checkout-stepper"
        currentStep={step}
        steps={[
          { label: "Your details", description: "Contact" },
          { label: "Delivery", description: "Address" },
          { label: "Review", description: "Payment" },
        ]}
      />
      <div className="checkout-layout">
        <section aria-live="polite" className="checkout-form" ref={checkoutRef}>
          {step === 0 ? (
            <>
              <div className="form-heading">
                <span>01</span>
                <div>
                  <h2>Your details</h2>
                  <p>Used for your order and delivery communication.</p>
                </div>
              </div>
              <div className="form-grid two-col">
                {field("firstName", "First name", "text", "given-name")}
                {field("lastName", "Last name", "text", "family-name")}
                {field("email", "Email address", "email", "email")}
                {field("phone", "Phone number", "tel", "tel")}
              </div>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <div className="form-heading">
                <span>02</span>
                <div>
                  <h2>Delivery</h2>
                  <p>Choose insured shipping or personal collection.</p>
                </div>
              </div>
              <fieldset className="choice-cards">
                <legend>Choose an option</legend>
                <label>
                  <input
                    checked={delivery === "shipping"}
                    name="delivery"
                    onChange={() => {
                      setDelivery("shipping");
                      setQuote(null);
                    }}
                    type="radio"
                  />
                  <strong>Shipping</strong>
                  <span>
                    {formatMoney(
                      cart.items.reduce((sum, entry) => sum + entry.shippingCents, 0),
                      item.currency,
                    )}
                  </span>
                </label>
                <label>
                  <input
                    checked={delivery === "collection"}
                    name="delivery"
                    onChange={() => {
                      setDelivery("collection");
                      setQuote(null);
                    }}
                    type="radio"
                  />
                  <strong>Personal collection</strong>
                  <span>Free · Details confirmed personally</span>
                </label>
              </fieldset>
              {delivery === "shipping" ? (
                <div className="form-grid two-col">
                  {field("address", "Street address", "text", "street-address")}
                  {field("suburb", "Suburb / city", "text", "address-level2")}
                  {field("state", "State / region", "text", "address-level1")}
                  {field("postcode", "Postcode", "text", "postal-code")}
                  {field("country", "Country", "text", "country-name")}
                  <label className="form-field form-field--wide">
                    <span>Delivery notes (optional)</span>
                    <textarea
                      onChange={(event) => update("notes", event.target.value)}
                      value={details.notes}
                    />
                  </label>
                </div>
              ) : null}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <div className="form-heading">
                <span>03</span>
                <div>
                  <h2>Review and payment</h2>
                  <p>Your total below has been calculated securely by the shop.</p>
                </div>
              </div>
              <div className="review-grid">
                <div>
                  <h3>Contact</h3>
                  <p>{details.firstName} {details.lastName}<br />{details.email}<br />{details.phone}</p>
                  <button className="text-button" onClick={() => setStep(0)} type="button">Edit</button>
                </div>
                <div>
                  <h3>Delivery</h3>
                  <p>
                    {delivery === "collection" ? "Personal collection" : <>{details.address}<br />{details.suburb} {details.state} {details.postcode}<br />{details.country}</>}
                  </p>
                  <button className="text-button" onClick={() => setStep(1)} type="button">Edit</button>
                </div>
              </div>
              <div className="discount-entry">
                <label className="form-field">
                  <span>Discount code</span>
                  <div className="discount-entry__controls">
                    <input
                      autoCapitalize="characters"
                      onChange={(event) => setDiscountEntry(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void applyDiscount();
                        }
                      }}
                      placeholder="WELCOME10"
                      value={discountEntry}
                    />
                    <button className="secondary-action" disabled={quoteBusy || !discountEntry.trim()} onClick={() => void applyDiscount()} type="button">Apply</button>
                  </div>
                </label>
                {discountCodes.map((code) => (
                  <button className="discount-chip" disabled={quoteBusy} key={code} onClick={() => void removeDiscount(code)} type="button">{code} <span aria-hidden="true">×</span></button>
                ))}
                {quoteError ? <p className="form-error" role="alert">{quoteError}</p> : null}
              </div>
              {paymentMode === "demo" ? (
                <DemoPaymentPanel amount={displayed.totalCents} currency={item.currency} enabled={checkoutEnabled} request={request} />
              ) : (
                <StripePaymentPanel
                  amount={displayed.totalCents}
                  currency={item.currency}
                  enabled={checkoutEnabled}
                  mode={paymentMode}
                  publishableKey={stripePublishableKey}
                  request={request}
                />
              )}
            </>
          ) : null}
          {step < 2 ? (
            <div className="form-actions">
              {step > 0 ? <button className="secondary-action" onClick={() => setStep(step - 1)} type="button">Back</button> : <Link className="secondary-action" href="/cart">Back to bag</Link>}
              <button className="primary-action" disabled={quoteBusy} onClick={() => void advance()} type="button">{quoteBusy ? "Calculating…" : "Continue"}</button>
              {quoteError ? <p className="form-error" role="alert">{quoteError}</p> : null}
            </div>
          ) : null}
        </section>
        <aside className="checkout-summary">
          <p className="eyebrow">{cart.items.length === 1 ? "One original" : `${cart.items.length} originals`}</p>
          <Image alt={item.image.alt} height={180} src={item.image.src} width={180} />
          <div>
            {cart.items.map((entry) => (
              <div className="checkout-summary__item" key={entry.id}>
                <h2>{entry.title}</h2>
                <p>{[entry.medium, entry.surface].filter(Boolean).join(" on ")} · {paintingDimensions(entry)}</p>
                <strong>{formatMoney(entry.priceCents, entry.currency)}</strong>
              </div>
            ))}
          </div>
          <hr />
          <dl className="checkout-totals">
            <div><dt>Artwork subtotal</dt><dd>{formatMoney(displayed.subtotalCents, item.currency)}</dd></div>
            {displayed.discounts.map((discount) => <div key={discount.code}><dt>{discount.code}</dt><dd>−{formatMoney(discount.appliedCents, item.currency)}</dd></div>)}
            <div><dt>Shipping</dt><dd>{formatMoney(displayed.shippingCents, item.currency)}</dd></div>
            <div className="checkout-summary__total"><dt>Total</dt><dd><strong>{formatMoney(displayed.totalCents, item.currency)}</strong></dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}
