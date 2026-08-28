import "server-only";

import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing email configuration: ${name}`);
  return value;
};

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;
  const port = Number.parseInt(process.env.SMTP2GO_SMTP_PORT ?? "443", 10);
  const usesImplicitTls = [443, 465, 8465].includes(port);
  transport = nodemailer.createTransport({
    host: required("SMTP2GO_SMTP_HOST"),
    port: Number.isFinite(port) ? port : 443,
    secure: usesImplicitTls,
    requireTLS: !usesImplicitTls,
    auth: {
      user: required("SMTP2GO_SMTP_USER"),
      pass: required("SMTP2GO_SMTP_PASSWORD"),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2" },
  });
  return transport;
}

export function describeEmailFailure(error: unknown) {
  if (!error || typeof error !== "object") return "SMTP delivery failed";
  const smtpError = error as {
    code?: unknown;
    command?: unknown;
    responseCode?: unknown;
  };
  const details = [smtpError.code, smtpError.command, smtpError.responseCode]
    .filter((value): value is string | number =>
      ["string", "number"].includes(typeof value),
    )
    .map(String)
    .slice(0, 3);
  return details.length
    ? `SMTP delivery failed (${details.join(" / ")})`
    : "SMTP delivery failed";
}

export function assertTransactionalEmailConfigured() {
  required("EMAIL_FROM");
  required("SMTP2GO_SMTP_HOST");
  required("SMTP2GO_SMTP_USER");
  required("SMTP2GO_SMTP_PASSWORD");
  if (
    process.env.EMAIL_DELIVERY_MODE !== "live" &&
    !process.env.EMAIL_TEST_RECIPIENT?.trim()
  )
    throw new Error("Email delivery mode is not configured");
}

export async function sendTransactionalEmail(input: TransactionalEmail) {
  assertTransactionalEmailConfigured();
  const live = process.env.EMAIL_DELIVERY_MODE === "live";
  const recipient = live ? input.to : required("EMAIL_TEST_RECIPIENT");
  const info = await getTransport().sendMail({
    from: required("EMAIL_FROM"),
    to: recipient,
    replyTo: input.replyTo,
    subject: live ? input.subject : `[TEST for ${input.to}] ${input.subject}`,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
  return info.messageId || null;
}
