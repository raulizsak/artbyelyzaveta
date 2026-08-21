"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import { COWS_AT_DUSK, formatMoney, paintingDimensions } from "@/lib/catalog";

export function CartPageClient() {
  const cart = useCart();
  if (!cart.count)
    return (
      <div className="empty-state cart-empty">
        <p className="eyebrow">Your bag</p>
        <h1>Your bag is quiet.</h1>
        <p>Explore the available original and return when one feels right.</p>
        {cart.removedItem ? (
          <button
            className="text-button"
            onClick={cart.undoRemove}
            type="button"
          >
            Undo removal
          </button>
        ) : null}
        <SmoothButton
          asChild
          className="cta cta--primary"
          size="lg"
          variant="solid"
        >
          <Link href="/shop">Browse the collection</Link>
        </SmoothButton>
      </div>
    );
  return (
    <>
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Your selection</p>
        <h1>Shopping Bag</h1>
      </header>
      <div className="cart-page-layout">
        <section aria-label="Bag items" className="cart-page-items">
          <article className="cart-page-line">
            <Image
              alt={COWS_AT_DUSK.media[0].alt}
              height={260}
              src={COWS_AT_DUSK.media[0].src}
              width={260}
            />
            <div>
              <p className="eyebrow">One-of-one original</p>
              <h2>
                <Link href="/shop/cows-at-dusk">{COWS_AT_DUSK.title}</Link>
              </h2>
              <p>Oil on canvas · {paintingDimensions(COWS_AT_DUSK)}</p>
              <p>Ready to hang · Certificate included</p>
              <strong>{formatMoney(COWS_AT_DUSK.price)}</strong>
            </div>
            <button
              aria-label="Remove Cows at Dusk"
              className="icon-button"
              onClick={() => cart.remove(COWS_AT_DUSK.slug)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </article>
          <Link className="text-link" href="/shop">
            <ArrowLeft aria-hidden="true" size={16} /> Continue browsing
          </Link>
        </section>
        <aside className="order-summary">
          <h2>Order summary</h2>
          <div>
            <span>Original artwork</span>
            <span>{formatMoney(cart.subtotal)}</span>
          </div>
          <div>
            <span>Shipping</span>
            <span>Confirmed separately</span>
          </div>
          <div className="order-summary__total">
            <strong>Total</strong>
            <strong>{formatMoney(cart.subtotal)}</strong>
          </div>
          <SmoothButton
            asChild
            className="cta cta--primary"
            size="lg"
            variant="solid"
          >
            <Link href="/checkout">Continue to demo checkout</Link>
          </SmoothButton>
          <p>
            <ShieldCheck aria-hidden="true" size={15} /> This demonstration
            never asks for card details.
          </p>
        </aside>
      </div>
    </>
  );
}
