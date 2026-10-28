import "server-only";
import { renderOrderEmail } from "@/lib/email/order-template";
import { renderShopNotification } from "@/lib/email/smtp2go";
import { classifyEmailFailure } from "@/lib/email/delivery-outcome";
import {
  assertTransactionalEmailConfigured,
  deliverTransactionalEmail,
} from "@/lib/email/transport";
import { SITE_URL } from "@/lib/site";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Job = Database["public"]["Tables"]["email_outbox"]["Row"];
type Admin = ReturnType<typeof createAdminClient>;

async function renderEnquiry(admin: Admin, job: Job) {
  if (!job.source_id) throw new Error("Enquiry reference unavailable");
  if (job.source_type === "contact") {
    const { data, error } = await admin
      .from("contact_enquiries")
      .select("*")
      .eq("id", job.source_id)
      .single();
    if (error || !data) throw new Error("Enquiry unavailable");
    return renderShopNotification({
      subject: "New contact enquiry — " + data.subject,
      heading: "New contact enquiry",
      replyTo: data.email,
      rows: [
        ["Name", data.name],
        ["Email", data.email],
        ["Subject", data.subject],
      ],
      message: data.message,
    });
  }
  const { data, error } = await admin
    .from("commission_enquiries")
    .select("*, commission_inspiration_files(*)")
    .eq("id", job.source_id)
    .single();
  if (error || !data) throw new Error("Commission enquiry unavailable");
  const files = data.commission_inspiration_files ?? [];
  const attachments = [];
  const links = [];
  for (const file of files) {
    const result = await admin.storage
      .from("commission-inspiration")
      .download(file.storage_path);
    if (result.error || !result.data)
      throw new Error("Inspiration photograph unavailable");
    const signed = await admin.storage
      .from("commission-inspiration")
      .createSignedUrl(file.storage_path, 604800);
    const name = file.storage_path.split("/").pop() || "inspiration";
    attachments.push({
      filename: name,
      content: Buffer.from(await result.data.arrayBuffer()),
      contentType: file.mime_type,
    });
    if (signed.data?.signedUrl)
      links.push({ label: name, url: signed.data.signedUrl });
  }
  return renderShopNotification({
    subject: "New commission enquiry — " + data.subject,
    heading: "New commission enquiry",
    replyTo: data.email,
    rows: [
      ["Name", data.name],
      ["Email", data.email],
      ["Phone", data.phone],
      ["Subject", data.subject],
      ["Dimensions", data.dimensions],
      ["Budget", data.budget],
      ["Timing", data.timing],
      ["Additional notes", data.notes],
      ["Inspiration files", String(files.length)],
    ],
    message: data.inspiration || "",
    attachments,
    links,
  });
}

async function renderJob(admin: Admin, job: Job) {
  if (
    job.source_type === "operational" &&
    job.template === "notification_alert"
  ) {
    const counts = (job.payload ?? {}) as Record<string, unknown>;
    return renderShopNotification({
      subject: "Notifications need attention",
      heading: "Notification delivery needs attention",
      rows: [
        ["Require reconciliation", String(counts.attention ?? 0)],
        ["Waiting over 15 minutes", String(counts.delayed ?? 0)],
      ],
      message:
        "Review the notification records and SMTP2GO activity before retrying an uncertain delivery.",
      links: [
        {
          label: "Review notifications",
          url: SITE_URL + "/admin/notifications",
        },
      ],
    });
  }
  if (job.source_type === "contact" || job.source_type === "commission")
    return renderEnquiry(admin, job);
  if (!job.order_id) throw new Error("Order reference unavailable");
  const { data, error } = await admin
    .from("orders")
    .select("*, order_items(*), order_discounts(*)")
    .eq("id", job.order_id)
    .single();
  if (error || !data) throw new Error("Order unavailable");
  const order = data as unknown as Record<string, unknown> & {
    order_items: Record<string, unknown>[];
  };
  let payload = (job.payload ?? {}) as Record<string, unknown>;
  if (!order.customer_user_id && typeof payload.guest_token !== "string") {
    const { data: confirmation } = await admin
      .from("email_outbox")
      .select("payload")
      .eq("order_id", job.order_id)
      .eq("template", "order_confirmation")
      .maybeSingle();
    const original = (confirmation?.payload ?? {}) as Record<string, unknown>;
    if (typeof original.guest_token === "string")
      payload = { ...payload, guest_token: original.guest_token };
  }
  const message = renderOrderEmail({
    template: job.template,
    order,
    items: order.order_items,
    payload,
    siteUrl: SITE_URL,
  });
  return {
    ...message,
    attachments:
      job.template === "invoice"
        ? [
            {
              filename: String(order.order_reference) + ".pdf",
              content: await generateInvoicePdf(order, order.order_items),
              contentType: "application/pdf",
            },
          ]
        : undefined,
  };
}

export async function triggerEmailOutbox(orderId?: string) {
  const summary = {
    accepted: 0,
    retry: 0,
    permanent: 0,
    ambiguous: 0,
    workerError: false,
  };
  const began = Date.now();
  let admin: Admin | undefined;
  try {
    assertTransactionalEmailConfigured();
    admin = createAdminClient();
    const heartbeat = await admin.from("email_worker_health").upsert({
      id: true,
      started_at: new Date().toISOString(),
      last_error: null,
    });
    if (heartbeat.error) throw new Error("Notification heartbeat unavailable");
    const alert = await admin.rpc("enqueue_notification_alert");
    if (alert.error) throw new Error("Notification monitoring unavailable");
    for (let index = 0; index < 5 && Date.now() - began < 45_000; index++) {
      const claim = await admin.rpc("claim_email_outbox", {
        p_limit: 1,
        ...(orderId ? { p_order_id: orderId } : {}),
      });
      if (claim.error) throw new Error("Notification claim failed");
      const job = claim.data?.[0];
      if (!job?.lease_token) break;
      let started = false;
      try {
        const message = await renderJob(admin, job);
        const recipient =
          job.recipient === "STORE_NOTIFICATION_EMAIL"
            ? process.env.STORE_NOTIFICATION_EMAIL?.trim()
            : job.recipient === "ADMIN_EMAIL"
              ? process.env.ADMIN_EMAIL?.trim()
              : job.recipient;
        if (!recipient)
          throw new Error("Notification recipient is not configured");
        const start = await admin.rpc("start_email_delivery", {
          p_id: job.id,
          p_lease: job.lease_token,
        });
        if (start.error || start.data !== true)
          throw new Error("Delivery lease unavailable");
        started = true;
        const delivery = await deliverTransactionalEmail({
          to: recipient,
          ...message,
          messageId: "<outbox-" + job.id + "@artbyelyzaveta.shop>",
        });
        const finish = await admin.rpc("finish_email_delivery", {
          p_id: job.id,
          p_lease: job.lease_token,
          p_outcome: "accepted",
          p_provider_id: delivery.providerId ?? undefined,
          p_message_id: delivery.messageId ?? undefined,
        });
        if (finish.error || finish.data !== true) {
          // SMTP may have accepted the message. A stale started lease is later
          // quarantined, never automatically resent after an uncertain DB ack.
          summary.ambiguous++;
          console.error("notification-ack-unconfirmed", { jobId: job.id });
        } else summary.accepted++;
      } catch (cause) {
        const failure = started
          ? classifyEmailFailure(cause)
          : {
              outcome: "retry" as const,
              diagnostic: "Notification preparation unavailable",
            };
        summary[failure.outcome]++;
        const finish = await admin.rpc("finish_email_delivery", {
          p_id: job.id,
          p_lease: job.lease_token,
          p_outcome: failure.outcome,
          p_diagnostic: failure.diagnostic,
        });
        if (finish.error || finish.data !== true)
          console.error("notification-outcome-unconfirmed", { jobId: job.id });
      }
    }
    const completion = await admin
      .from("email_worker_health")
      .update({
        completed_at: new Date().toISOString(),
        summary,
        last_error:
          summary.permanent || summary.ambiguous
            ? "Notifications require attention"
            : null,
      })
      .eq("id", true);
    if (completion.error) throw new Error("Notification heartbeat unavailable");
  } catch {
    summary.workerError = true;
    console.error("notification-worker-unavailable");
    if (admin)
      await admin
        .from("email_worker_health")
        .update({
          last_error: "Worker configuration or database unavailable",
          summary,
        })
        .eq("id", true);
  }
  return summary;
}
