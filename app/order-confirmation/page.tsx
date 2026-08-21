import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/order-confirmation";
export const metadata: Metadata = { title: "Demo Order Confirmation" };
export default function ConfirmationPage() {
  return (
    <main className="confirmation-page shell" id="main-content">
      <Suspense>
        <OrderConfirmation />
      </Suspense>
    </main>
  );
}
