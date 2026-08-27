import "server-only";

import { renderOrderEmail } from "@/lib/email/order-template";
import {
  assertTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/email/transport";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export async function triggerEmailOutbox(orderId?: string) {
  try {
    assertTransactionalEmailConfigured();
    const admin = createAdminClient();
    const { data: jobs, error } = await admin.rpc("claim_email_outbox", {
      p_limit: 10,
      ...(orderId ? { p_order_id: orderId } : {}),
    });
    if (error) return;
    for (const job of jobs ?? []) {
      try {
        const { data } = await admin
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", job.order_id!)
          .single();
        if (!data) throw new Error("Order unavailable");
        const order = data as unknown as Record<string, unknown> & {
          order_items?: Record<string, unknown>[];
        };
        let payload = (job.payload ?? {}) as Record<string, unknown>;
        if (
          !order.customer_user_id &&
          typeof payload.guest_token !== "string"
        ) {
          const { data: confirmation } = await admin
            .from("email_outbox")
            .select("payload")
            .eq("order_id", order.id as string)
            .eq("template", "order_confirmation")
            .maybeSingle();
          const confirmationPayload = (confirmation?.payload ?? {}) as Record<
            string,
            unknown
          >;
          if (typeof confirmationPayload.guest_token === "string")
            payload = {
              ...payload,
              guest_token: confirmationPayload.guest_token,
            };
        }
        const message = renderOrderEmail({
          template: job.template,
          order,
          items: order.order_items ?? [],
          payload,
          siteUrl: SITE_URL.replace(/\/$/, ""),
        });
        const intended =
          job.recipient === "STORE_NOTIFICATION_EMAIL"
            ? process.env.STORE_NOTIFICATION_EMAIL?.trim()
            : job.recipient === "ADMIN_EMAIL"
              ? process.env.ADMIN_EMAIL?.trim()
              : job.recipient;
        if (!intended) throw new Error("Recipient unavailable");
        const providerId = await sendTransactionalEmail({
          to: intended,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        await admin
          .from("email_outbox")
          .update({
            status: "sent",
            provider_message_id: providerId,
            last_error: null,
            sent_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "sending");
      } catch {
        await admin
          .from("email_outbox")
          .update({
            status: "failed",
            last_error: "Provider delivery failed",
            next_attempt_at: new Date(
              Date.now() + 15 * 60 * 1000,
            ).toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "sending");
      }
    }
  } catch {
    // Delivery remains queued; order state is intentionally unaffected.
  }
}
