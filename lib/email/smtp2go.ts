import "server-only";

import { sendTransactionalEmail } from "@/lib/email/transport";

type ShopNotification = {
  subject: string;
  heading: string;
  replyTo: string;
  rows: Array<[string, string | null | undefined]>;
  message: string;
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export async function sendShopNotification(input: ShopNotification) {
  const recipient = process.env.STORE_NOTIFICATION_EMAIL?.trim();
  if (!recipient) throw new Error("Shop email delivery is not configured");

  const detailText = input.rows
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
  const detailHtml = input.rows
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><th style="padding:7px 12px 7px 0;text-align:left;vertical-align:top;color:#6d6b61">${escapeHtml(label)}</th><td style="padding:7px 0">${escapeHtml(value!)}</td></tr>`,
    )
    .join("");
  return sendTransactionalEmail({
    to: recipient,
    subject: input.subject,
    replyTo: input.replyTo,
    text: `${input.heading}\n\n${detailText}\n\nMessage:\n${input.message}\n\nReply directly to this email to contact the customer.`,
    html: `<!doctype html><html><body style="margin:0;background:#f7f3eb;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cb;padding:32px"><p style="letter-spacing:.16em;font-size:12px;color:#5f6548">ART BY ELYZAVETA · ENQUIRY</p><h1 style="font-family:Georgia,serif;font-weight:500">${escapeHtml(input.heading)}</h1><table style="border-collapse:collapse;width:100%">${detailHtml}</table><h2 style="font-family:Georgia,serif;font-weight:500;margin-top:28px">Message</h2><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(input.message)}</p><p style="font-size:13px;color:#6d6b61;margin-top:28px">Reply directly to this email to contact the customer.</p></div></div></body></html>`,
  });
}
