import { timingSafeEqual } from "node:crypto";
import { triggerEmailOutbox } from "@/lib/email/outbox";

export const runtime = "nodejs";

const matchesSecret = (provided: string, expected: string) => {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: Request) {
  const expected = process.env.EMAIL_OUTBOX_TRIGGER_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-email-outbox-secret") ?? "";
  if (!expected || !matchesSecret(provided, expected))
    return new Response("Unauthorized", { status: 401 });
  await triggerEmailOutbox();
  return Response.json({ accepted: true });
}
