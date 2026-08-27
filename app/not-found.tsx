import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
export default function NotFound() {
  return (
    <main className="not-found shell" id="main-content">
      <BrandLogo compact />
      <p className="eyebrow">404 · Off the canvas</p>
      <h1>This page has wandered beyond the frame.</h1>
      <p>
        The work you were looking for may have moved, or the address may be
        incomplete.
      </p>
      <div className="button-row">
        <Link className="cta-link" href="/shop">
          View original paintings
        </Link>
        <Link className="secondary-action" href="/home">
          Return home
        </Link>
      </div>
    </main>
  );
}
