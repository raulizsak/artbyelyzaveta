import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAccount } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

const links = [
  ["Overview", "/account"],
  ["Orders", "/account/orders"],
  ["Returns", "/account/returns"],
  ["Profile", "/account/profile"],
  ["Addresses", "/account/addresses"],
  ["Payment methods", "/account/payment-methods"],
  ["Security", "/account/security"],
];
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAccount();
  return (
    <main className="dashboard-shell shell" id="main-content">
      <aside className="dashboard-nav">
        <p className="eyebrow">Your account</p>
        <strong>{user.profile.first_name || user.email}</strong>
        <nav>
          {links.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        {user.profile.role === "admin" ? (
          <Link className="secondary-action" href="/admin">
            Shop administration
          </Link>
        ) : null}
        <SignOutButton />
      </aside>
      <div className="dashboard-content">{children}</div>
    </main>
  );
}
