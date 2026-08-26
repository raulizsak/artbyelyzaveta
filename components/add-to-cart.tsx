"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import type { CartPainting } from "@/lib/catalog";

export function AddToCart({
  painting,
  buyNow = false,
}: {
  painting: CartPainting;
  buyNow?: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const inCart = cart.items.some((item) => item.slug === painting.slug);
  const unavailable = painting.status !== "available";

  return (
    <SmoothButton
      className="cta cta--primary product-action"
      disabled={unavailable}
      onClick={() => {
        cart.add(painting);
        if (buyNow) {
          cart.setCartOpen(false);
          router.push("/checkout");
        }
      }}
      size="lg"
      type="button"
      variant="solid"
    >
      {unavailable ? (
        "Original unavailable"
      ) : inCart && !buyNow ? (
        <>
          <Check aria-hidden="true" size={17} /> Added to bag
        </>
      ) : buyNow ? (
        "Buy original"
      ) : (
        "Add original to bag"
      )}
    </SmoothButton>
  );
}
