"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  House,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { label: "Overview", href: "/account", icon: House },
  { label: "Orders", href: "/account/orders", icon: Package },
  { label: "Returns", href: "/account/returns", icon: RotateCcw },
  { label: "Profile", href: "/account/profile", icon: UserRound },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  {
    label: "Payment methods",
    href: "/account/payment-methods",
    icon: CreditCard,
  },
  { label: "Security", href: "/account/security", icon: ShieldCheck },
];

export function AccountNavigation({
  name,
  isAdmin,
}: {
  name: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <aside className="dashboard-nav account-navigation">
      <div className="account-navigation__identity">
        <p className="eyebrow">Your account</p>
        <strong>{name}</strong>
      </div>
      <nav aria-label="Account navigation">
        {links.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      {isAdmin ? (
        <Link className="secondary-action account-admin-link" href="/admin">
          <SlidersHorizontal aria-hidden="true" size={17} /> Shop administration
        </Link>
      ) : null}
      <button
        className="account-sign-out"
        onClick={async () => {
          await createClient().auth.signOut();
          router.replace("/");
          router.refresh();
        }}
        type="button"
      >
        <LogOut aria-hidden="true" size={18} /> Sign out
      </button>
    </aside>
  );
}
