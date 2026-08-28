import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Package, RotateCcw, ShieldCheck } from "lucide-react";
import { requireAccount } from "@/lib/auth/authorization";
export default async function Page() {
  const user = await requireAccount();
  return (
    <section className="account-overview">
      <header className="account-overview__hero">
        <div>
          <p className="eyebrow">Account overview</p>
          <h1>
            Hello{user.profile.first_name ? `, ${user.profile.first_name}` : ""}
            .
          </h1>
          <p>
            Track orders, manage delivery details, access invoices and keep your
            account secure.
          </p>
        </div>
        <Image
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="(max-width: 850px) 100vw, 70vw"
          src="/optimized/artwork/cows-at-dusk-warm-room-main.webp"
        />
      </header>
      <div className="account-feature-cards">
        <Link href="/account/orders">
          <Image
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            src="/optimized/artwork/cows-at-dusk-gallery-wall-card.webp"
          />
          <span className="account-feature-card__content">
            <Package aria-hidden="true" />
            <strong>Orders</strong>
            <small>
              Follow each artwork from confirmation through delivery.
            </small>
            <b>
              View orders <ArrowUpRight aria-hidden="true" size={16} />
            </b>
          </span>
        </Link>
        <Link href="/account/returns">
          <Image
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            src="/optimized/artwork/cows-at-dusk-classic-room-card.webp"
          />
          <span className="account-feature-card__content">
            <RotateCcw aria-hidden="true" />
            <strong>Returns</strong>
            <small>
              Start an eligible return and follow Lisa&apos;s response.
            </small>
            <b>
              Manage returns <ArrowUpRight aria-hidden="true" size={16} />
            </b>
          </span>
        </Link>
        <Link href="/account/security">
          <Image
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            src="/optimized/artwork/cows-at-dusk-modern-room-card.webp"
          />
          <span className="account-feature-card__content">
            <ShieldCheck aria-hidden="true" />
            <strong>Security</strong>
            <small>
              Change your password and manage authenticator protection.
            </small>
            <b>
              Review security <ArrowUpRight aria-hidden="true" size={16} />
            </b>
          </span>
        </Link>
      </div>
      <footer className="account-gratitude">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">A note from the studio</p>
          <h2>Thank you for supporting original art.</h2>
          <p>
            Every painting is created, packed and cared for personally in
            Melbourne.
          </p>
        </div>
      </footer>
    </section>
  );
}
