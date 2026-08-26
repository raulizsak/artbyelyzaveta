import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function triggerEmailOutbox(orderId?: string) {
  try {
    await createAdminClient().functions.invoke("email-outbox", {
      body: { orderId: orderId ?? null },
    });
  } catch {
    // Delivery remains queued; order state is intentionally unaffected.
  }
}
