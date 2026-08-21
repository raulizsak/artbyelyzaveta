import type { Metadata } from "next";
import { CheckoutClient } from "@/components/checkout-client";

export const metadata: Metadata = { title: "Demo Checkout" };
export default function CheckoutPage() {
  return (
    <main className="checkout-page shell" id="main-content">
      <CheckoutClient />
    </main>
  );
}
