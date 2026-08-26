// @ts-nocheck -- Supabase Edge Functions are checked by Deno.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = Deno.env.get("SMTP2GO_API_KEY") ?? "";
const sender = Deno.env.get("EMAIL_FROM") ?? "";
const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "";
const siteUrl = (
  Deno.env.get("SITE_URL") ?? "https://artbyelyzaveta.shop"
).replace(/\/$/, "");
const testRecipient = Deno.env.get("EMAIL_TEST_RECIPIENT") ?? "";
const live = Deno.env.get("EMAIL_DELIVERY_MODE") === "live";
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const labels: Record<string, string> = {
  order_confirmation: "Your artwork order is confirmed",
  admin_new_order: "New paid artwork order",
  admin_return_requested: "New return request",
  shipment: "Your artwork is on its way",
  order_update: "An update about your artwork order",
  commission_update: "An update about your commissioned artwork",
  refund_initiated: "Your refund has been initiated",
  return_requested: "Return request received",
  return_needs_information: "More information is needed",
  return_approved: "Your return request is approved",
  return_declined: "An update about your return request",
  return_awaiting_return: "Return shipping details",
  return_received: "Your returned artwork was received",
  return_refunded: "Your refund is complete",
  return_closed: "Your return request is closed",
  refund_completed: "Your refund is complete",
  invoice: "Your Art by Elyzaveta invoice",
};

function render(
  template: string,
  order: Record<string, unknown>,
  items: Record<string, unknown>[],
  payload: Record<string, unknown>,
) {
  const reference = String(order.order_reference);
  const guestToken =
    typeof payload.guest_token === "string" ? payload.guest_token : "";
  const customerOrderUrl = guestToken
    ? `${siteUrl}/order-access?token=${encodeURIComponent(guestToken)}`
    : `${siteUrl}/account/orders/${encodeURIComponent(reference)}`;
  const invoiceUrl = `${siteUrl}/api/orders/${encodeURIComponent(reference)}/invoice${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""}`;
  const formattedTotal = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: String(order.currency || "AUD"),
  }).format(Number(order.total_cents || 0) / 100);
  const subject =
    template === "admin_new_order"
      ? `New order ${order.order_reference} — ${items[0]?.title ?? "Original artwork"}`
      : `${labels[template] ?? "Order update"} — ${order.order_reference}`;
  const title = labels[template] ?? "Order update";
  const safeMessage = order.customer_status_message
    ? `<p style="padding:16px;background:#f7f3eb;border-left:3px solid #5f6548">${escape(order.customer_status_message)}</p>`
    : "";
  const commissionDetails = order.commission_stage
    ? `<p>Commission stage: ${escape(String(order.commission_stage).replaceAll("_", " "))}${order.commission_eta ? `<br>Estimated completion: ${escape(order.commission_eta)}` : ""}${order.expected_dispatch ? `<br>Expected dispatch: ${escape(order.expected_dispatch)}` : ""}</p>`
    : "";
  if (template.startsWith("admin_")) {
    const adminUrl = `${siteUrl}/admin/orders/${encodeURIComponent(reference)}`;
    const address = (order.shipping_address ?? {}) as Record<string, unknown>;
    const addressText = [
      address.recipient_name,
      address.line1,
      address.line2,
      [address.suburb, address.state, address.postcode]
        .filter(Boolean)
        .join(" "),
      address.country,
    ]
      .filter(Boolean)
      .join(", ");
    const adminTitle =
      template === "admin_new_order"
        ? "New paid artwork order"
        : "New return request";
    return {
      subject,
      html: `<!doctype html><html><body style="margin:0;background:#f7f3eb;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cb;padding:32px"><p style="letter-spacing:.16em;font-size:12px;color:#5f6548">ART BY ELYZAVETA · ADMIN</p><h1 style="font-family:Georgia,serif;font-weight:500">${adminTitle}</h1><p>Order <strong>${escape(reference)}</strong> is ready for review.</p><p>Date: ${escape(new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(new Date(String(order.created_at))))}<br>Artwork: ${escape(items[0]?.title ?? "Original artwork")}<br>Dimensions: ${escape(items[0]?.dimensions ?? "Not specified")}<br>Amount: ${escape(formattedTotal)}<br>Customer: ${escape(order.customer_first_name)} ${escape(order.customer_last_name)}<br>Email: ${escape(order.customer_email)}<br>Phone: ${escape(order.customer_phone ?? "Not provided")}<br>Delivery: ${escape(order.delivery_method)}${addressText ? `<br>Address: ${escape(addressText)}` : ""}<br>Notes: ${escape(order.delivery_notes ?? "None")}<br>Payment: ${escape(order.payment_status)}<br>Fulfillment: ${escape(order.fulfillment_status)}</p><p><a href="${adminUrl}" style="display:inline-block;background:#5f6548;color:white;padding:12px 18px;text-decoration:none">Open order in admin</a></p><p style="font-size:13px;color:#6d6b61">Admin access requires your password and TOTP verification.</p></div></div></body></html>`,
      text: `${adminTitle}\n\nOrder ${reference}\nDate: ${new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(new Date(String(order.created_at)))}\nArtwork: ${items[0]?.title ?? "Original artwork"}\nDimensions: ${items[0]?.dimensions ?? "Not specified"}\nAmount: ${formattedTotal}\nCustomer: ${order.customer_first_name} ${order.customer_last_name}\nEmail: ${order.customer_email}\nPhone: ${order.customer_phone ?? "Not provided"}\nDelivery: ${order.delivery_method}\nAddress: ${addressText || "Collection / manual arrangement"}\nNotes: ${order.delivery_notes ?? "None"}\nPayment: ${order.payment_status}\nFulfillment: ${order.fulfillment_status}\n\nOpen in admin: ${adminUrl}`,
    };
  }
  const actionUrl = template === "invoice" ? invoiceUrl : customerOrderUrl;
  const actionLabel =
    template === "invoice" ? "View your invoice" : "View your order";
  const html = `<!doctype html><html><body style="margin:0;background:#f7f3eb;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cb;padding:32px"><p style="letter-spacing:.16em;font-size:12px;color:#5f6548">ART BY ELYZAVETA</p><h1 style="font-family:Georgia,serif;font-weight:500">${escape(title)}</h1><p>Hello ${escape(order.customer_first_name)},</p><p>Order <strong>${escape(reference)}</strong> for ${escape(items[0]?.title ?? "your artwork")}.</p>${safeMessage}${commissionDetails}<p>Payment: ${escape(order.payment_status)}<br>Fulfillment: ${escape(order.fulfillment_status)}</p>${order.tracking_url ? `<p><a href="${escape(order.tracking_url)}" style="color:#454a35">Track your delivery</a></p>` : ""}<p><a href="${escape(actionUrl)}" style="display:inline-block;background:#5f6548;color:white;padding:12px 18px;text-decoration:none">${actionLabel}</a></p><hr style="border:0;border-top:1px solid #ded8cb;margin:28px 0"><p style="font-size:13px;color:#6d6b61">Thank you for supporting original art.</p></div></div></body></html>`;
  const text = `${title}\n\nOrder ${reference}\n${items[0]?.title ?? "Original artwork"}\nPayment: ${order.payment_status}\nFulfillment: ${order.fulfillment_status}\n${order.customer_status_message ?? ""}\n\n${actionLabel}: ${actionUrl}`;
  return { subject, html, text };
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!apiKey || !sender || !adminEmail || (!live && !testRecipient))
    return new Response("Email delivery is not configured", { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization !== `Bearer ${serviceRole}`)
    return new Response("Unauthorized", { status: 401 });
  const input = await request.json().catch(() => ({}));
  const { data: jobs, error: claimError } = await supabase.rpc(
    "claim_email_outbox",
    { p_order_id: input.orderId ?? null, p_limit: 10 },
  );
  if (claimError) return new Response("Outbox unavailable", { status: 503 });
  let sent = 0;
  for (const job of jobs ?? []) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", job.order_id)
        .single();
      const items = order.order_items ?? [];
      let payload = job.payload ?? {};
      if (!order.customer_user_id && typeof payload.guest_token !== "string") {
        const { data: confirmation } = await supabase
          .from("email_outbox")
          .select("payload")
          .eq("order_id", order.id)
          .eq("template", "order_confirmation")
          .maybeSingle();
        if (typeof confirmation?.payload?.guest_token === "string")
          payload = {
            ...payload,
            guest_token: confirmation.payload.guest_token,
          };
      }
      const message = render(job.template, order, items, payload);
      const intended =
        job.recipient === "ADMIN_EMAIL" ? adminEmail : job.recipient;
      const recipient = live ? intended : testRecipient;
      const response = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          sender,
          to: [recipient],
          subject: live
            ? message.subject
            : `[TEST for ${intended}] ${message.subject}`,
          html_body: message.html,
          text_body: message.text,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.data?.succeeded !== 1)
        throw new Error("provider-rejected");
      await supabase
        .from("email_outbox")
        .update({
          status: "sent",
          provider_message_id: result?.data?.email_id ?? null,
          last_error: null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "sending");
      sent += 1;
    } catch {
      await supabase
        .from("email_outbox")
        .update({
          status: "failed",
          last_error: "Provider delivery failed",
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .eq("id", job.id)
        .eq("status", "sending");
    }
  }
  return Response.json({ processed: (jobs ?? []).length, sent });
});
