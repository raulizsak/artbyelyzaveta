import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Choose a new password" };
export default function Page() {
  return (
    <main className="auth-page shell" id="main-content">
      <Suspense>
        <AuthForm mode="reset" />
      </Suspense>
    </main>
  );
}
