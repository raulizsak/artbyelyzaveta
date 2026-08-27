import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

const links = [
  ["Overview", "/admin"],
  ["Orders", "/admin/orders"],
  ["Paintings", "/admin/paintings"],
  ["Returns", "/admin/returns"],
  ["Subscribers", "/admin/subscribers"],
];
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminAal2("/admin");
  return (
    <main className="dashboard-shell admin-shell shell" id="main-content">
      <aside className="dashboard-nav">
        <p className="eyebrow">Shop administration</p>
        <strong>Art by Elyzaveta</strong>
        <nav>
          {links.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Link className="secondary-action" href="/account">
          Customer account
        </Link>
      </aside>
      <div className="dashboard-content">{children}</div>
    </main>
  );
}
