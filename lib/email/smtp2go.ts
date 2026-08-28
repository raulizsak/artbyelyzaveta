import "server-only";

import { sendTransactionalEmail } from "@/lib/email/transport";
import type { EmailAttachment } from "@/lib/email/transport";

type ShopNotification = {
  subject: string;
  heading: string;
  replyTo: string;
  rows: Array<[string, string | null | undefined]>;
  message: string;
  attachments?: EmailAttachment[];
  links?: Array<{ label: string; url: string }>;
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
  const linkText = (input.links ?? [])
    .map((link) => `${link.label}: ${link.url}`)
    .join("\n");
  const linkHtml = (input.links ?? [])
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" style="display:block;color:#454a35;margin:8px 0">${escapeHtml(link.label)}</a>`,
    )
    .join("");
  return sendTransactionalEmail({
    to: recipient,
    subject: input.subject,
    replyTo: input.replyTo,
    text: `${input.heading}\n\n${detailText}\n\nMessage:\n${input.message}${linkText ? `\n\nPrivate attachment links (7 days):\n${linkText}` : ""}\n\nReply directly to this email to contact the customer.`,
    html: `<!doctype html><html><body style="margin:0;background:#f3eee3;color:#23261f;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;padding:34px 18px"><div style="background:#fffdf8;border:1px solid #d9ceb8;border-radius:14px;padding:42px"><div style="text-align:center;color:#b69a64;font-size:27px">❦</div><p style="letter-spacing:.2em;font-size:11px;color:#5f6548;text-align:center">ART BY ELYZAVETA · ENQUIRY</p><h1 style="font-family:Georgia,serif;font-size:42px;line-height:1.05;font-weight:400;text-align:center;margin:28px 0 34px">${escapeHtml(input.heading)}</h1><div style="height:1px;background:#d9ceb8;margin:0 18% 28px"></div><table style="border-collapse:collapse;width:100%;border:1px solid #ded8cb">${detailHtml}</table><div style="text-align:center;color:#b69a64;font-size:24px;margin-top:30px">❦</div><h2 style="font-family:Georgia,serif;font-size:28px;font-weight:400;text-align:center;margin:8px 0 16px">Message</h2><p style="white-space:pre-wrap;line-height:1.7;background:#fbf8f1;border:1px solid #e5dccb;border-radius:8px;padding:20px">${escapeHtml(input.message)}</p>${linkHtml ? `<div style="margin-top:22px"><strong>Private attachment links · available for 7 days</strong>${linkHtml}</div>` : ""}<div style="height:1px;background:#d9ceb8;margin:30px 0 20px"></div><p style="font-family:Georgia,serif;font-style:italic;text-align:center;color:#6d6b61">Reply directly to this email to contact the customer.</p></div></div></body></html>`,
    attachments: input.attachments,
  });
}
