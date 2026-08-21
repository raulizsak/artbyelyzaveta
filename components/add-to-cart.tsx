"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import { COWS_AT_DUSK } from "@/lib/catalog";

export function AddToCart({ buyNow = false }: { buyNow?: boolean }) {
  const cart = useCart();
  const router = useRouter();
  const inCart = cart.items.some((item) => item.slug === COWS_AT_DUSK.slug);

  return (
    <SmoothButton
      className="cta cta--primary product-action"
      onClick={() => {
        cart.add(COWS_AT_DUSK);
        if (buyNow) {
          cart.setCartOpen(false);
          router.push("/checkout");
        }
      }}
      size="lg"
      type="button"
      variant="solid"
    >
      {inCart && !buyNow ? (
        <>
          <Check aria-hidden="true" size={17} /> Added to bag
        </>
      ) : buyNow ? (
        "Buy original — demo"
      ) : (
        "Add original to bag"
      )}
    </SmoothButton>
  );
}
