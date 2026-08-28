import { AccountNavigation } from "@/components/account-navigation";
import { requireAccount } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAccount();
  return (
    <main className="dashboard-shell shell" id="main-content">
      <AccountNavigation
        isAdmin={user.profile.role === "admin"}
        name={user.profile.first_name || user.email}
      />
      <div className="dashboard-content">{children}</div>
    </main>
  );
}
