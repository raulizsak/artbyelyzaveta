import { ChevronDown, Search } from "lucide-react";
import { AdminNavigation } from "@/components/admin-navigation";
import { requireAdminAal2 } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

const initials = (firstName: string | null, lastName: string | null) =>
  `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "AE";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireAdminAal2("/admin");
  const displayName =
    [identity.profile.first_name, identity.profile.last_name]
      .filter(Boolean)
      .join(" ") || "Elyzaveta";

  return (
    <main className="admin-portal" id="main-content">
      <AdminNavigation />
      <section className="admin-workspace">
        <header className="admin-topbar">
          <form action="/admin/orders" className="admin-topbar__search">
            <Search aria-hidden="true" size={18} />
            <label className="sr-only" htmlFor="admin-global-search">
              Search orders, customers, or paintings
            </label>
            <input
              id="admin-global-search"
              name="q"
              placeholder="Search orders, customers, paintings…"
              type="search"
            />
          </form>
          <div className="admin-topbar__profile">
            <span className="admin-profile-avatar">
              {initials(
                identity.profile.first_name,
                identity.profile.last_name,
              )}
            </span>
            <span>
              <strong>{displayName}</strong>
              <small>Shop admin</small>
            </span>
            <ChevronDown aria-hidden="true" size={16} />
          </div>
        </header>
        <div className="admin-workspace__content">{children}</div>
      </section>
    </main>
  );
}
