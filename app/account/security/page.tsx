import { Suspense } from "react";
import { MfaManager } from "@/components/mfa-manager";
import { requireAccount } from "@/lib/auth/authorization";
export default async function Page() {
  const user = await requireAccount("/account/security");
  return (
    <Suspense>
      <MfaManager isAdmin={user.profile.role === "admin"} />
    </Suspense>
  );
}
