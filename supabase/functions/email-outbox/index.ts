// @ts-nocheck -- Supabase Edge Functions are checked by Deno.
// Compatibility entry point: all delivery uses the single fenced SMTP worker.
const secret = Deno.env.get("EMAIL_OUTBOX_TRIGGER_SECRET") ?? "";
const endpoint = "https://artbyelyzaveta.shop/api/internal/email-outbox";

async function authorised(value: string) {
  if (!secret || !value) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
  ]);
  const a = new Uint8Array(left),
    b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!(await authorised(request.headers.get("x-email-outbox-secret") ?? "")))
    return new Response("Unauthorized", { status: 401 });
  const input = await request.json().catch(() => ({}));
  if (input.orderId != null && !/^[a-f0-9-]{36}$/i.test(input.orderId))
    return new Response("Invalid order reference", { status: 400 });
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-email-outbox-secret": secret,
      },
      body: JSON.stringify(input.orderId ? { orderId: input.orderId } : {}),
      signal: AbortSignal.timeout(90000),
    });
    return new Response(await result.text(), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // A timeout does not authorise another SMTP send. The worker's lease and
    // reconciliation state determine whether any job can be safely retried.
    return new Response("Notification worker unavailable", { status: 503 });
  }
});
