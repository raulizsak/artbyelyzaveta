"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/smoothui/drawer";
import { BrandLogo } from "@/components/brand-logo";
import { useCart } from "@/components/cart-provider";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import { COWS_AT_DUSK, formatMoney } from "@/lib/catalog";

const navigation = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/commissions", label: "Commissions" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchOpen(false);
    router.push(
      `/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <BrandLogo />
          <nav aria-label="Primary navigation" className="site-nav">
            {navigation.map((item) => (
              <Link
                aria-current={pathname === item.href ? "page" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="site-header__actions">
            <button
              aria-label="Search paintings"
              className="icon-button"
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" size={19} strokeWidth={1.7} />
            </button>
            <button
              aria-label={`Open shopping bag, ${cart.count} item${cart.count === 1 ? "" : "s"}`}
              className="icon-button bag-button"
              onClick={() => cart.setCartOpen(true)}
              type="button"
            >
              <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.7} />
              {cart.count > 0 ? <span>{cart.count}</span> : null}
            </button>
            <button
              aria-label="Open menu"
              className="icon-button mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" size={21} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </header>

      <Drawer
        className="gallery-drawer gallery-drawer--right"
        description="Original paintings and studio information"
        onOpenChange={setMenuOpen}
        open={menuOpen}
        side="right"
        title="Menu"
      >
        <nav aria-label="Mobile navigation" className="drawer-nav">
          {navigation.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Drawer>

      <Drawer
        className="gallery-drawer gallery-drawer--right"
        onOpenChange={setSearchOpen}
        open={searchOpen}
        side="right"
        title="Search the collection"
      >
        <form className="search-form" onSubmit={submitSearch} role="search">
          <label htmlFor="site-search">Painting title or keyword</label>
          <div>
            <input
              autoComplete="off"
              id="site-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try ‘landscape’"
              value={query}
            />
            <button
              aria-label="Submit search"
              className="icon-button"
              type="submit"
            >
              <Search aria-hidden="true" size={19} />
            </button>
          </div>
          <p>One original is currently available.</p>
        </form>
      </Drawer>

      <Drawer
        className="gallery-drawer gallery-drawer--right cart-drawer"
        description="Original artwork is held in your browser only."
        footer={
          cart.count ? (
            <div className="cart-drawer__footer">
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(cart.subtotal)}</strong>
              </div>
              <SmoothButton
                asChild
                className="cta cta--primary"
                size="lg"
                variant="solid"
              >
                <Link href="/checkout" onClick={() => cart.setCartOpen(false)}>
                  Continue to demo checkout
                </Link>
              </SmoothButton>
              <Link
                className="text-link text-link--center"
                href="/cart"
                onClick={() => cart.setCartOpen(false)}
              >
                View bag
              </Link>
            </div>
          ) : undefined
        }
        onOpenChange={cart.setCartOpen}
        open={cart.isCartOpen}
        side="right"
        title="Your bag"
      >
        {cart.count ? (
          <div className="cart-line">
            <Image
              alt={COWS_AT_DUSK.media[0].alt}
              height={120}
              src={COWS_AT_DUSK.media[0].src}
              width={120}
            />
            <div>
              <Link
                href="/shop/cows-at-dusk"
                onClick={() => cart.setCartOpen(false)}
              >
                <strong>{COWS_AT_DUSK.title}</strong>
              </Link>
              <p>Oil on canvas · 90 × 60 cm</p>
              <span>{formatMoney(COWS_AT_DUSK.price)}</span>
            </div>
            <button
              aria-label="Remove Cows at Dusk from bag"
              className="icon-button"
              onClick={() => cart.remove(COWS_AT_DUSK.slug)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <ShoppingBag aria-hidden="true" size={28} strokeWidth={1.4} />
            <h2>Your bag is quiet.</h2>
            <p>
              Explore the available original and return when one feels right.
            </p>
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
              <Link href="/shop" onClick={() => cart.setCartOpen(false)}>
                Browse the collection
              </Link>
            </SmoothButton>
          </div>
        )}
      </Drawer>
    </>
  );
}
