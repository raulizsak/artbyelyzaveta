import { AccountNavigation } from "@/components/account-navigation";
import { requireAccount } from "@/lib/auth/authorization";
import { Suspense } from "react";
import { AccountPortalSkeleton } from "@/components/page-skeletons";
import { getPaymentMode, isTestCheckoutEnabled } from "@/lib/env";

export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AccountPortalSkeleton />}>
      <ProtectedAccountLayout>{children}</ProtectedAccountLayout>
    </Suspense>
  );
}

async function ProtectedAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAccount();
  return (
    <main className="dashboard-shell shell" id="main-content">
      <AccountNavigation
        canSaveCards={getPaymentMode() === "test" && isTestCheckoutEnabled()}
        isAdmin={user.profile.role === "admin"}
        name={user.profile.first_name || user.email}
      />
      <div className="dashboard-content">{children}</div>
    </main>
  );
}
