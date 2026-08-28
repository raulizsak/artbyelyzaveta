import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { ComingSoonSignup } from "@/components/coming-soon-signup";

export const metadata: Metadata = {
  title: "Coming soon",
  description:
    "The new Art by Elyzaveta shop is coming soon. Join the private launch list.",
};

export default function HomePage() {
  return (
    <main className="coming-soon" id="main-content">
      <div className="coming-soon__wash" aria-hidden="true" />
      <section className="coming-soon__card">
        <BrandLogo className="coming-soon__logo" />
        <p className="eyebrow">Your new art shop</p>
        <h1>Coming soon</h1>
        <p className="coming-soon__lede">
          A considered collection of original oil paintings, created in
          Melbourne and made to bring atmosphere, warmth and a sense of place
          into your home.
        </p>
        <ComingSoonSignup />
        <p className="coming-soon__place">Melbourne, Australia</p>
      </section>
    </main>
  );
}
