"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import Drawer from "@/components/smoothui/drawer";
import { BrandLogo } from "@/components/brand-logo";
import { useCart } from "@/components/cart-provider";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import { formatMoney, paintingDimensions } from "@/lib/catalog";

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
            <Link
              aria-label="Your account"
              className="icon-button"
              href="/account"
            >
              <UserRound aria-hidden="true" size={19} strokeWidth={1.7} />
            </Link>
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
          <p>Search current and sold original works.</p>
        </form>
      </Drawer>

      <Drawer
        className="gallery-drawer gallery-drawer--right cart-drawer"
        description="Your selection is saved on this device until checkout."
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
                  Continue to checkout
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
          <div className="cart-lines">
            {cart.items.map((item) => (
              <div className="cart-line" key={item.id}>
                <Image
                  alt={item.image.alt}
                  height={120}
                  src={item.image.thumbnailSrc}
                  width={120}
                />
                <div>
                  <Link
                    href={`/shop/${item.slug}`}
                    onClick={() => cart.setCartOpen(false)}
                  >
                    <strong>{item.title}</strong>
                  </Link>
                  <p>
                    {item.medium ?? "Original artwork"} ·{" "}
                    {paintingDimensions(item)}
                  </p>
                  <span>{formatMoney(item.priceCents, item.currency)}</span>
                </div>
                <button
                  aria-label={`Remove ${item.title} from bag`}
                  className="icon-button"
                  onClick={() => cart.remove(item.slug)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>
            ))}
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
