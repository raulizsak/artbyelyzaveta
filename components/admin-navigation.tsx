"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Images,
  Menu,
  Package,
  RotateCcw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import Drawer from "@/components/smoothui/drawer";

const links = [
  { label: "Overview", href: "/admin", icon: House },
  { label: "Orders", href: "/admin/orders", icon: Package },
  { label: "Paintings", href: "/admin/paintings", icon: Images },
  { label: "Returns", href: "/admin/returns", icon: RotateCcw },
  { label: "Subscribers", href: "/admin/subscribers", icon: UsersRound },
];

function SidebarContents({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <div className="admin-sidebar__brand">
        <p className="eyebrow">Shop administration</p>
        <BrandLogo className="admin-sidebar__logo" />
      </div>
      <nav aria-label="Shop administration">
        {links.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              href={href}
              key={href}
              onClick={onNavigate}
            >
              <span className="admin-sidebar__icon">
                <Icon aria-hidden="true" size={20} strokeWidth={1.55} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
      <Link
        className="admin-sidebar__account"
        href="/account"
        onClick={onNavigate}
      >
        <UserRound aria-hidden="true" size={20} strokeWidth={1.55} />
        Customer account
      </Link>
      <div className="admin-sidebar__art" aria-hidden="true">
        <Image
          alt=""
          fill
          sizes="320px"
          src="/optimized/artwork/cows-at-dusk-gallery-wall-large.webp"
        />
      </div>
    </>
  );
}

export function AdminNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="admin-sidebar admin-sidebar--desktop">
        <SidebarContents />
      </aside>
      <div className="admin-mobile-nav">
        <button
          aria-label="Open shop administration menu"
          className="admin-mobile-nav__button"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={21} /> Menu
        </button>
        <Drawer
          className="gallery-drawer admin-mobile-drawer"
          onOpenChange={setOpen}
          open={open}
          side="left"
          title="Shop administration"
        >
          <div className="admin-sidebar admin-sidebar--mobile">
            <SidebarContents onNavigate={() => setOpen(false)} />
          </div>
        </Drawer>
      </div>
    </>
  );
}
