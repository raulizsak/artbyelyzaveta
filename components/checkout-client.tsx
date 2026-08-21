"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import AnimatedStepper from "@/components/smoothui/animated-stepper";
import { useCart } from "@/components/cart-provider";
import { PaymentPanel } from "@/components/payment-panel";
import { COWS_AT_DUSK, formatMoney } from "@/lib/catalog";

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

export function CheckoutClient() {
  const cart = useCart();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(initial);
  const [delivery, setDelivery] = useState<"shipping" | "collection">(
    "shipping",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = window.sessionStorage.getItem("art-by-elyzaveta-checkout");
    // Session storage restores an intentionally browser-local demonstration checkout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setDetails(JSON.parse(stored) as Details);
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
  const advance = () => {
    if (step === 0 && !validateDetails()) return;
    if (step === 1 && !validateDelivery()) return;
    setStep((current) => Math.min(2, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const complete = () => {
    const reference = `ABE-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    window.sessionStorage.setItem(
      "art-by-elyzaveta-demo-order",
      JSON.stringify({
        reference,
        firstName: details.firstName,
        email: details.email,
        delivery,
        title: COWS_AT_DUSK.title,
        total: cart.subtotal || COWS_AT_DUSK.price,
      }),
    );
    window.sessionStorage.removeItem("art-by-elyzaveta-checkout");
    cart.clear();
    toast.success("Demo order created");
    router.push(`/order-confirmation?reference=${reference}`);
  };
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

  if (!cart.count && step < 2)
    return (
      <div className="empty-state checkout-empty">
        <p className="eyebrow">Demo checkout</p>
        <h1>Your bag is empty.</h1>
        <p>Add the available original before entering the checkout.</p>
        <Link className="cta-link" href="/shop">
          Return to the collection
        </Link>
      </div>
    );

  return (
    <>
      <header className="checkout-header">
        <div>
          <p className="eyebrow">Payment-free demonstration</p>
          <h1>Checkout</h1>
        </div>
        <p>No card details will be requested.</p>
      </header>
      <AnimatedStepper
        className="checkout-stepper"
        currentStep={step}
        steps={[
          { label: "Your details", description: "Contact" },
          { label: "Delivery", description: "Arrangement" },
          { label: "Review", description: "Demo confirmation" },
        ]}
      />
      <div className="checkout-layout">
        <section className="checkout-form" aria-live="polite">
          {step === 0 ? (
            <>
              <div className="form-heading">
                <span>01</span>
                <div>
                  <h2>Your details</h2>
                  <p>Used only to demonstrate the checkout flow.</p>
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
                  <h2>Delivery arrangement</h2>
                  <p>
                    Shipping costs and final arrangements would be confirmed
                    personally.
                  </p>
                </div>
              </div>
              <fieldset className="choice-cards">
                <legend>Choose an option</legend>
                <label>
                  <input
                    checked={delivery === "shipping"}
                    name="delivery"
                    onChange={() => setDelivery("shipping")}
                    type="radio"
                  />
                  <strong>Arrange shipping</strong>
                  <span>
                    Quote and timing confirmed before a real purchase.
                  </span>
                </label>
                <label>
                  <input
                    checked={delivery === "collection"}
                    name="delivery"
                    onChange={() => setDelivery("collection")}
                    type="radio"
                  />
                  <strong>Melbourne collection</strong>
                  <span>
                    Collection time and location confirmed personally.
                  </span>
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
                      onChange={(e) => update("notes", e.target.value)}
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
                  <h2>Review</h2>
                  <p>
                    Check your details, then create a local demo confirmation.
                  </p>
                </div>
              </div>
              <div className="review-grid">
                <div>
                  <h3>Contact</h3>
                  <p>
                    {details.firstName} {details.lastName}
                    <br />
                    {details.email}
                    <br />
                    {details.phone}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setStep(0)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
                <div>
                  <h3>Delivery</h3>
                  <p>
                    {delivery === "collection" ? (
                      "Melbourne collection — arrangements to be confirmed"
                    ) : (
                      <>
                        {details.address}
                        <br />
                        {details.suburb} {details.state} {details.postcode}
                        <br />
                        {details.country}
                      </>
                    )}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setStep(1)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <PaymentPanel
                amount={cart.subtotal || COWS_AT_DUSK.price}
                currency="AUD"
                onComplete={complete}
              />
            </>
          ) : null}
          {step < 2 ? (
            <div className="form-actions">
              {step > 0 ? (
                <button
                  className="secondary-action"
                  onClick={() => setStep(step - 1)}
                  type="button"
                >
                  Back
                </button>
              ) : (
                <Link className="secondary-action" href="/cart">
                  Back to bag
                </Link>
              )}
              <button
                className="primary-action"
                onClick={advance}
                type="button"
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
        <aside className="checkout-summary">
          <p className="eyebrow">One original</p>
          <Image
            alt={COWS_AT_DUSK.media[0].alt}
            height={180}
            src={COWS_AT_DUSK.media[0].src}
            width={180}
          />
          <div>
            <h2>{COWS_AT_DUSK.title}</h2>
            <p>Oil on canvas · 90 × 60 cm</p>
            <strong>{formatMoney(COWS_AT_DUSK.price)}</strong>
          </div>
          <hr />
          <p className="checkout-summary__total">
            <span>Demo total</span>
            <strong>{formatMoney(COWS_AT_DUSK.price)}</strong>
          </p>
        </aside>
      </div>
    </>
  );
}
