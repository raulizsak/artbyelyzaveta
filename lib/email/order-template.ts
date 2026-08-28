import { publicArtworkUrl } from "../media-url";

type OrderRecord = Record<string, unknown>;

type CustomerVariant =
  | "confirmation"
  | "preparing"
  | "shipped"
  | "delivered"
  | "delayed"
  | "cancelled"
  | "invoice"
  | "commission"
  | "return"
  | "refund"
  | "update";

const variants: Record<
  CustomerVariant,
  {
    heading: string;
    eyebrow: string;
    intro: string;
    accent: string;
    symbol: string;
  }
> = {
  confirmation: {
    heading: "Your artwork order is confirmed",
    eyebrow: "Order confirmation",
    intro:
      "Thank you. Your original artwork has been reserved and the studio has received your order.",
    accent: "#5f6548",
    symbol: "✓",
  },
  preparing: {
    heading: "Your artwork is being prepared",
    eyebrow: "Studio preparation",
    intro:
      "Your artwork is now being carefully prepared for you. Elyzaveta will let you know as soon as it is on its way.",
    accent: "#746b4a",
    symbol: "✦",
  },
  shipped: {
    heading: "Your artwork has shipped",
    eyebrow: "On its way",
    intro:
      "Your order is on its way. The delivery details below will help you follow its journey to you.",
    accent: "#455638",
    symbol: "→",
  },
  delivered: {
    heading: "Your artwork has been delivered",
    eyebrow: "Delivered",
    intro:
      "Your artwork has arrived. I hope it brings atmosphere and joy to your home for many years to come.",
    accent: "#536548",
    symbol: "✓",
  },
  delayed: {
    heading: "An update about your artwork",
    eyebrow: "Delivery update",
    intro:
      "I’m sorry that your artwork is taking a little longer than planned. The latest studio update is below.",
    accent: "#8a6a3e",
    symbol: "!",
  },
  cancelled: {
    heading: "Your order has been cancelled",
    eyebrow: "Order cancellation",
    intro:
      "This order will not proceed. The details and any message from the studio are included below for your records.",
    accent: "#7b4a43",
    symbol: "×",
  },
  invoice: {
    heading: "Your invoice is ready",
    eyebrow: "Invoice",
    intro:
      "Thank you for your order. Your invoice is available securely from the link below for your records.",
    accent: "#4f5941",
    symbol: "▤",
  },
  commission: {
    heading: "A commission update from the studio",
    eyebrow: "Commission progress",
    intro: "Elyzaveta has shared a new update about your commissioned artwork.",
    accent: "#665878",
    symbol: "✦",
  },
  return: {
    heading: "An update about your return",
    eyebrow: "Return update",
    intro:
      "The status of your return request has changed. You can review the latest details below.",
    accent: "#5e6650",
    symbol: "↶",
  },
  refund: {
    heading: "An update about your refund",
    eyebrow: "Refund update",
    intro:
      "The payment status for your order has changed. Please review the details below.",
    accent: "#4d6170",
    symbol: "$",
  },
  update: {
    heading: "An update about your artwork order",
    eyebrow: "Order update",
    intro: "Elyzaveta has shared a new update about your order.",
    accent: "#5f6548",
    symbol: "✦",
  },
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

const humanize = (input: unknown) =>
  value(input, "Not yet available").replaceAll("_", " ");

const formatDate = (input: unknown) => {
  if (!input) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(input))
    ? `${input}T00:00:00`
    : String(input);
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "long" }).format(
    new Date(normalized),
  );
};

function resolveVariant(template: string, order: OrderRecord): CustomerVariant {
  if (template === "order_confirmation") return "confirmation";
  if (template === "invoice") return "invoice";
  if (template === "shipment") return "shipped";
  if (template === "commission_update") return "commission";
  if (order.order_status === "cancelled") return "cancelled";
  if (template.startsWith("return_")) return "return";
  if (template.startsWith("refund_")) return "refund";
  if (order.order_status === "delayed") return "delayed";
  if (order.fulfillment_status === "delivered") return "delivered";
  if (order.fulfillment_status === "shipped") return "shipped";
  if (order.fulfillment_status === "preparing") return "preparing";
  return "update";
}

function summaryRows(
  order: OrderRecord,
  artwork: string,
  total: string,
  variant: CustomerVariant,
) {
  const rows: Array<[string, string]> = [
    ["Artwork", artwork],
    ["Amount", total],
    ["Delivery", humanize(order.delivery_method)],
    [
      "Payment",
      order.is_demo === true
        ? "Demo order · no payment taken"
        : humanize(order.payment_status),
    ],
    ["Fulfillment", humanize(order.fulfillment_status)],
  ];
  if (variant === "shipped" && order.tracking_number)
    rows.push(["Tracking number", value(order.tracking_number)]);
  if (variant === "delivered" && order.delivered_at)
    rows.push(["Delivered on", formatDate(order.delivered_at)]);
  if (
    variant === "delayed" &&
    (order.expected_dispatch || order.commission_eta)
  )
    rows.push([
      "Updated estimate",
      formatDate(order.expected_dispatch || order.commission_eta),
    ]);
  if (variant === "commission" && order.commission_stage)
    rows.push(["Commission stage", humanize(order.commission_stage)]);
  return rows;
}

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
  const productImage = publicArtworkUrl(items[0]?.image_path, siteUrl);
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
      ["Delivery", humanize(order.delivery_method)],
      ["Address", addressText || "Collection / manual arrangement"],
      ["Notes", value(order.delivery_notes, "None")],
      ["Payment", humanize(order.payment_status)],
      ["Fulfillment", humanize(order.fulfillment_status)],
    ];
    const rows = details
      .map(
        ([label, detail]) =>
          `<tr><th style="padding:9px 14px;text-align:left;vertical-align:top;color:#5f6548;border-bottom:1px solid #e4ddcf">${escapeHtml(label)}</th><td style="padding:9px 14px;border-bottom:1px solid #e4ddcf">${escapeHtml(detail)}</td></tr>`,
      )
      .join("");
    return {
      subject: `${title} ${reference} — ${artwork}`,
      html: `<!doctype html><html><body style="margin:0;background:#f3eee3;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;padding:30px 16px"><div style="background:#fffdf8;border:1px solid #d9ceb8;border-radius:14px;padding:38px"><p style="text-align:center;color:#b69a64;font-size:25px;margin:0">❦</p><p style="letter-spacing:.2em;font-size:11px;color:#5f6548;text-align:center">ART BY ELYZAVETA · ADMIN</p><h1 style="font-family:Georgia,serif;font-size:40px;font-weight:400;text-align:center">${escapeHtml(title)}</h1>${productImage ? `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(artwork)}" width="604" style="display:block;width:100%;height:230px;object-fit:cover;border:1px solid #ded8cb">` : ""}${isDemo ? '<p style="padding:13px;background:#f7f3eb;border-left:3px solid #b69a64"><strong>DEMO:</strong> No payment was taken and Stripe was not contacted.</p>' : ""}<table style="border-collapse:collapse;width:100%;margin-top:22px;border:1px solid #ded8cb">${rows}</table><p style="text-align:center;margin-top:28px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#5f6548;color:white;padding:13px 22px;text-decoration:none;border-radius:4px">Open order in admin</a></p><p style="font-size:12px;color:#6d6b61;text-align:center">Admin access requires password and current TOTP verification.</p></div></div></body></html>`,
      text: `${title}\n\n${isDemo ? "DEMO: No payment was taken and Stripe was not contacted.\n\n" : ""}${details.map(([label, detail]) => `${label}: ${detail}`).join("\n")}\n\nOpen in admin: ${adminUrl}`,
    };
  }

  const variant = resolveVariant(template, order);
  const style = variants[variant];
  const actionUrl = variant === "invoice" ? invoiceUrl : orderUrl;
  const actionLabel =
    variant === "invoice"
      ? "View invoice"
      : variant === "shipped" && order.tracking_url
        ? "Track your artwork"
        : "View your order";
  const primaryAction =
    variant === "shipped" && order.tracking_url
      ? value(order.tracking_url)
      : actionUrl;
  const customerMessage = value(order.customer_status_message);
  const rows = summaryRows(order, artwork, total, variant)
    .map(
      ([label, detail]) =>
        `<tr><th style="padding:7px 12px 7px 0;text-align:left;color:#6d6b61;font-size:12px;font-weight:400">${escapeHtml(label)}</th><td style="padding:7px 0;font-size:13px">${escapeHtml(detail)}</td></tr>`,
    )
    .join("");
  const subject = `${style.heading} — ${reference}`;
  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#f3eee3;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:700px;margin:auto;padding:28px 14px"><div style="background:#fffdf8;border:1px solid #ded8cb;box-shadow:0 12px 35px rgba(35,38,31,.08)"><div style="padding:34px 38px 20px"><table role="presentation" style="width:100%"><tr><td><img src="${escapeHtml(`${siteUrl}/brand-email-logo.svg`)}" alt="Art by Elyzaveta" width="220" style="display:block;max-width:220px;height:auto"></td><td style="text-align:right"><span style="display:inline-block;width:46px;height:46px;border-radius:50%;background:${style.accent};color:white;line-height:46px;text-align:center;font-family:Georgia,serif;font-size:23px">${escapeHtml(style.symbol)}</span></td></tr></table><p style="letter-spacing:.2em;font-size:10px;color:${style.accent};margin-top:32px;text-transform:uppercase">${escapeHtml(style.eyebrow)}</p><h1 style="font-family:Georgia,serif;font-size:43px;line-height:1.05;font-weight:400;margin:8px 0 22px;max-width:560px">${escapeHtml(style.heading)}</h1><div style="width:70px;height:1px;background:#b69a64;margin-bottom:24px"></div><p style="line-height:1.7;margin:0 0 20px">Hello ${escapeHtml(order.customer_first_name)},</p><p style="line-height:1.7;margin:0 0 22px">${escapeHtml(style.intro)}</p></div>${productImage ? `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(artwork)}" width="698" style="display:block;width:100%;height:260px;object-fit:cover;border-block:1px solid #ded8cb">` : ""}<div style="padding:26px 38px 34px"><div style="border:1px solid #ded8cb;border-radius:8px;padding:20px"><p style="margin:0 0 12px"><strong>Order ${escapeHtml(reference)}</strong></p><table style="border-collapse:collapse;width:100%">${rows}</table>${isDemo ? '<p style="background:#f7f3eb;border-left:3px solid #b69a64;padding:11px 13px;font-size:12px;margin:14px 0 0"><strong>Private preview:</strong> this was a demo order. No card was charged and no payment was taken.</p>' : ""}</div>${customerMessage ? `<div style="margin-top:20px;padding:16px 18px;background:#f7f3eb;border-left:3px solid ${style.accent}"><strong>Update from the studio</strong><p style="line-height:1.6;margin:7px 0 0">${escapeHtml(customerMessage)}</p></div>` : ""}<p style="text-align:center;margin:26px 0 4px"><a href="${escapeHtml(primaryAction)}" style="display:inline-block;background:${style.accent};color:white;padding:14px 24px;text-decoration:none;border-radius:4px">${escapeHtml(actionLabel)} &nbsp;→</a></p></div><div style="background:#f7f3eb;border-top:1px solid #ded8cb;padding:22px 38px"><p style="font-family:Georgia,serif;color:#5f6548;margin:0;font-size:17px">Thank you for supporting original art.</p><p style="color:#6d6b61;font-size:12px;margin:7px 0 0">Every painting is created with care in Melbourne and meant to be cherished.</p></div></div></div></body></html>`,
    text: `${style.heading}\n\nHello ${value(order.customer_first_name)},\n\n${style.intro}${isDemo ? "\n\nThis is a demo order. No payment was taken." : ""}\n\nOrder: ${reference}\n${summaryRows(
      order,
      artwork,
      total,
      variant,
    )
      .map(([label, detail]) => `${label}: ${detail}`)
      .join(
        "\n",
      )}${customerMessage ? `\n\nUpdate from the studio: ${customerMessage}` : ""}\n\n${actionLabel}: ${primaryAction}`,
  };
}
