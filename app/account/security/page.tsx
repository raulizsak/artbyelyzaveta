import { Suspense } from "react";
import { MfaManager } from "@/components/mfa-manager";
import { PasswordChangeForm } from "@/components/password-change-form";
import { requireAccount } from "@/lib/auth/authorization";
export default async function Page() {
  const user = await requireAccount("/account/security");
  return (
    <div className="security-page-stack">
      <Suspense>
        <MfaManager isAdmin={user.profile.role === "admin"} />
      </Suspense>
      <PasswordChangeForm email={user.email} />
    </div>
  );
}
