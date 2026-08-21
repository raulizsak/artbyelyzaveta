"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const key = "art-by-elyzaveta-logo-seen";
    if (!window.sessionStorage.getItem(key)) {
      // Session storage is external state; this client-only flag intentionally hydrates after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimate(true);
      window.sessionStorage.setItem(key, "true");
    }
  }, []);

  return (
    <Link
      aria-label="Art by Elyzaveta — return home"
      className={cn("brand-logo", animate && "brand-logo--animate", className)}
      href="/"
      onClick={(event) => {
        if (window.location.pathname === "/") {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      <svg
        aria-hidden="true"
        className="brand-logo__mark"
        fill="none"
        viewBox="0 0 54 54"
      >
        <path
          className="brand-logo__easel"
          d="M17 36.5 10.5 50M36 36.5 43.5 50M26.5 36.5V50M12 50h32"
        />
        <rect
          className="brand-logo__canvas"
          height="27"
          rx="1.5"
          width="34"
          x="10"
          y="7"
        />
        <path
          className="brand-logo__stroke"
          d="M16 25.5c5-7 9.5 5 14-1.5 3.8-5.4 7.5-.5 10-5"
        />
        <g className="brand-logo__brush">
          <path d="m35.5 41 9-14.5" />
          <path d="m44.5 26.5 2-4.5" />
          <path d="m34.2 43.2 1.3-2.2" />
        </g>
      </svg>
      {!compact && (
        <span className="brand-logo__wordmark">
          <span>Art by</span>
          <strong>Elyzaveta</strong>
        </span>
      )}
    </Link>
  );
}
