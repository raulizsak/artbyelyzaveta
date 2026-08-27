import "server-only";

import nodemailer from "nodemailer";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing email configuration: ${name}`);
  return value;
};

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transport) return transport;
  const port = Number.parseInt(process.env.SMTP2GO_SMTP_PORT ?? "2525", 10);
  transport = nodemailer.createTransport({
    host: required("SMTP2GO_SMTP_HOST"),
    port: Number.isFinite(port) ? port : 2525,
    secure: port === 465,
    requireTLS: port !== 465,
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
  });
  return info.messageId || null;
}
