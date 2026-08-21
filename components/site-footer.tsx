import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CONTACT_EMAIL } from "@/lib/site";

const policies = [
  ["Terms & Conditions", "/policies/terms-and-conditions"],
  ["Shipping", "/policies/shipping-policy"],
  ["Returns", "/policies/returns-and-refunds"],
  ["Privacy", "/policies/privacy-policy"],
  ["Commission Terms", "/policies/commission-terms"],
  ["Copyright", "/policies/copyright-and-usage"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__grid">
        <div>
          <BrandLogo />
          <p>Original oil paintings by Elyzaveta.</p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
        <nav aria-label="Footer navigation">
          <strong>Explore</strong>
          <Link href="/shop">Shop</Link>
          <Link href="/about">About</Link>
          <Link href="/commissions">Commissions</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <nav aria-label="Policies">
          <strong>Policies</strong>
          {policies.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="shell site-footer__base">
        <span>© {new Date().getFullYear()} Art by Elyzaveta</span>
        <span>Melbourne, Australia · Phase 1 demo store</span>
      </div>
    </footer>
  );
}
