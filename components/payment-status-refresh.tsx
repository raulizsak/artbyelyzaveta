"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const MAX_CHECKS = 12;

/** Mounted only while the server says payment is pending; never infers payment success. */
export function PaymentStatusRefresh() {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const [refreshing, startTransition] = useTransition();

  useEffect(() => {
    if (checks >= MAX_CHECKS || refreshing) return;
    const timer = window.setTimeout(() => {
      setChecks((count) => count + 1);
      if (document.visibilityState !== "hidden") {
        startTransition(() => router.refresh());
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checks, refreshing, router]);

  return (
    <p className="form-help" role="status">
      {checks < MAX_CHECKS
        ? "Checking your payment automatically. Please keep this page open."
        : "Confirmation is taking longer than usual. Use Refresh payment status below, and please do not pay again."}
    </p>
  );
}
