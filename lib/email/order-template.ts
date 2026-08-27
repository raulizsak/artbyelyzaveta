type OrderRecord = Record<string, unknown>;

const labels: Record<string, string> = {
  order_confirmation: "Your artwork order is confirmed",
  admin_new_order: "New artwork order",
  admin_return_requested: "New return request",
  shipment: "Your artwork is on its way",
  order_update: "An update about your artwork order",
  commission_update: "An update about your commissioned artwork",
  refund_initiated: "Your refund has been initiated",
  refund_completed: "Your refund is complete",
  return_requested: "Return request received",
  return_needs_information: "More information is needed",
  return_approved: "Your return request is approved",
  return_declined: "An update about your return request",
  return_awaiting_return: "Return shipping details",
  return_received: "Your returned artwork was received",
  return_refunded: "Your refund is complete",
  return_closed: "Your return request is closed",
  invoice: "Your Art by Elyzaveta invoice",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

const value = (input: unknown, fallback = "") =>
  input === null || input === undefined || input === ""
    ? fallback
    : String(input);

export function renderOrderEmail({
  template,
  order,
  items,
  payload,
  siteUrl,
}: {
  template: string;
  order: OrderRecord;
  items: OrderRecord[];
  payload: OrderRecord;
  siteUrl: string;
}) {
  const reference = value(order.order_reference);
  const artwork = value(items[0]?.title, "Original artwork");
  const dimensions = value(items[0]?.dimensions, "Not specified");
  const isDemo = order.is_demo === true;
  const guestToken = value(payload.guest_token);
  const orderUrl = guestToken
    ? `${siteUrl}/order-access?token=${encodeURIComponent(guestToken)}`
    : `${siteUrl}/account/orders/${encodeURIComponent(reference)}`;
  const invoiceUrl = `${siteUrl}/api/orders/${encodeURIComponent(reference)}/invoice${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""}`;
  const total = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: value(order.currency, "AUD"),
  }).format(Number(order.total_cents ?? 0) / 100);
  const heading = labels[template] ?? "Order update";
  const subject =
    template === "admin_new_order"
      ? `New ${isDemo ? "demo " : ""}order ${reference} — ${artwork}`
      : `${heading} — ${reference}`;

  if (template.startsWith("admin_")) {
    const address = (order.shipping_address ?? {}) as OrderRecord;
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
    const adminUrl = `${siteUrl}/admin/orders/${encodeURIComponent(reference)}`;
    const title =
      template === "admin_return_requested"
        ? "New return request"
        : isDemo
          ? "New demo artwork order"
          : "New paid artwork order";
    const details = [
      ["Order", reference],
      ["Artwork", artwork],
      ["Dimensions", dimensions],
      ["Amount", total],
      [
        "Customer",
        `${value(order.customer_first_name)} ${value(order.customer_last_name)}`.trim(),
      ],
      ["Email", value(order.customer_email)],
      ["Phone", value(order.customer_phone, "Not provided")],
      ["Delivery", value(order.delivery_method)],
      ["Address", addressText || "Collection / manual arrangement"],
      ["Notes", value(order.delivery_notes, "None")],
      ["Payment", value(order.payment_status)],
      ["Fulfillment", value(order.fulfillment_status)],
    ];
    const rows = details
      .map(
        ([label, detail]) =>
          `<tr><th style="padding:6px 12px 6px 0;text-align:left;vertical-align:top;color:#6d6b61">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(detail)}</td></tr>`,
      )
      .join("");
    return {
      subject,
      html: `<!doctype html><html><body style="margin:0;background:#f7f3eb;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cb;padding:32px"><p style="letter-spacing:.16em;font-size:12px;color:#5f6548">ART BY ELYZAVETA · ADMIN</p><h1 style="font-family:Georgia,serif;font-weight:500">${escapeHtml(title)}</h1>${isDemo ? '<p style="padding:10px;background:#f7f3eb"><strong>DEMO:</strong> No payment was taken and Stripe was not contacted.</p>' : ""}<table style="border-collapse:collapse;width:100%">${rows}</table><p><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#5f6548;color:white;padding:12px 18px;text-decoration:none">Open order in admin</a></p><p style="font-size:13px;color:#6d6b61">Admin access requires your password and TOTP verification.</p></div></div></body></html>`,
      text: `${title}\n\n${isDemo ? "DEMO: No payment was taken and Stripe was not contacted.\n\n" : ""}${details.map(([label, detail]) => `${label}: ${detail}`).join("\n")}\n\nOpen in admin: ${adminUrl}`,
    };
  }

  const actionUrl = template === "invoice" ? invoiceUrl : orderUrl;
  const actionLabel =
    template === "invoice" ? "View your invoice" : "View your order";
  const customerMessage = value(order.customer_status_message);
  const commission = order.commission_stage
    ? `<p>Commission stage: ${escapeHtml(value(order.commission_stage).replaceAll("_", " "))}${order.commission_eta ? `<br>Estimated completion: ${escapeHtml(order.commission_eta)}` : ""}${order.expected_dispatch ? `<br>Expected dispatch: ${escapeHtml(order.expected_dispatch)}` : ""}</p>`
    : "";
  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f7f3eb;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cb;padding:32px"><p style="letter-spacing:.16em;font-size:12px;color:#5f6548">ART BY ELYZAVETA</p><h1 style="font-family:Georgia,serif;font-weight:500">${escapeHtml(heading)}</h1><p>Hello ${escapeHtml(order.customer_first_name)},</p>${isDemo ? '<p style="padding:10px;background:#f7f3eb">This is a demo order. No payment was taken.</p>' : ""}<p>Order <strong>${escapeHtml(reference)}</strong><br>Artwork: ${escapeHtml(artwork)}<br>Amount: ${escapeHtml(total)}<br>Delivery: ${escapeHtml(order.delivery_method)}<br>Payment: ${escapeHtml(order.payment_status)}<br>Fulfillment: ${escapeHtml(order.fulfillment_status)}</p>${customerMessage ? `<p style="padding:16px;background:#f7f3eb;border-left:3px solid #5f6548">${escapeHtml(customerMessage)}</p>` : ""}${commission}${order.tracking_url ? `<p><a href="${escapeHtml(order.tracking_url)}" style="color:#454a35">Track your delivery</a></p>` : ""}<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#5f6548;color:white;padding:12px 18px;text-decoration:none">${actionLabel}</a></p><hr style="border:0;border-top:1px solid #ded8cb;margin:28px 0"><p style="font-size:13px;color:#6d6b61">Thank you for supporting original art.</p></div></div></body></html>`,
    text: `${heading}\n\nHello ${value(order.customer_first_name)},\n\n${isDemo ? "This is a demo order. No payment was taken.\n\n" : ""}Order: ${reference}\nArtwork: ${artwork}\nAmount: ${total}\nDelivery: ${value(order.delivery_method)}\nPayment: ${value(order.payment_status)}\nFulfillment: ${value(order.fulfillment_status)}\n${customerMessage}\n\n${actionLabel}: ${actionUrl}`,
  };
}
