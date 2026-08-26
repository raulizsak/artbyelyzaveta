"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart-provider";

export function ClearPurchasedCart() {
  const cart = useCart();
  useEffect(() => {
    window.sessionStorage.removeItem("art-by-elyzaveta-checkout");
    cart.clear();
    // Clearing occurs once after Stripe returns to a verified session page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
