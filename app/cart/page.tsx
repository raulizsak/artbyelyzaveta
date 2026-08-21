import type { Metadata } from "next";
import { CartPageClient } from "@/components/cart-page-client";

export const metadata: Metadata = { title: "Your Bag" };
export default function CartPage() {
  return (
    <main className="page-shell shell" id="main-content">
      <CartPageClient />
    </main>
  );
}
