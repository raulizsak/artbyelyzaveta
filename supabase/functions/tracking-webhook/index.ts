// @ts-nocheck -- Supabase Edge Functions are checked by Deno.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import {
  AUSTRALIA_POST_CARRIER_CODE,
  isWebhookOrderMatch,
  parse17TrackWebhook,
  verify17TrackSignature,
} from "./seventeen-track.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const securityKey = Deno.env.get("TRACK17_API_KEY") ?? "";
const renderEmailUrl = Deno.env.get("RENDER_EMAIL_OUTBOX_URL") ?? "";
const renderEmailSecret = Deno.env.get("RENDER_EMAIL_OUTBOX_SECRET") ?? "";
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const acknowledge = (detail: Record<string, unknown> = {}) =>
  Response.json({ accepted: true, ...detail });

async function triggerEmailOutbox() {
  if (!renderEmailUrl || !renderEmailSecret) return;
  await fetch(renderEmailUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-email-outbox-secret": renderEmailSecret,
    },
    body: JSON.stringify({ source: "17track-webhook" }),
  }).catch(() => undefined);
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (!securityKey || !supabaseUrl || !serviceRole)
    return new Response("Webhook unavailable", { status: 503 });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_000_000)
    return new Response("Payload too large", { status: 413 });

  const rawBody = await request.text();
  const signature = request.headers.get("sign") ?? "";
  if (!(await verify17TrackSignature(rawBody, securityKey, signature)))
    return new Response("Invalid signature", { status: 401 });

  const notification = parse17TrackWebhook(rawBody);
  if (!notification) return new Response("Invalid payload", { status: 400 });
  if (notification.carrier !== AUSTRALIA_POST_CARRIER_CODE)
    return acknowledge({ ignored: "unsupported_carrier" });

  const { data: candidates, error: lookupError } = await supabase
    .from("orders")
    .select(
      "id, delivery_method, fulfillment_status, is_demo, order_status, tracking_carrier_code, tracking_number, tracking_provider",
    )
    .eq("tracking_provider", "17track")
    .eq("tracking_carrier_code", AUSTRALIA_POST_CARRIER_CODE)
    .ilike("tracking_number", notification.number)
    .limit(2);
  if (lookupError) return new Response("Webhook unavailable", { status: 503 });
  if (
    candidates?.length !== 1 ||
    !isWebhookOrderMatch(candidates[0], notification)
  )
    return acknowledge({ ignored: "unknown_or_stale_tracking_number" });

  const stopped = notification.event === "TRACKING_STOPPED";
  const delivered =
    notification.event === "TRACKING_UPDATED" &&
    notification.status === "Delivered";
  const latestEvent =
    notification.event === "TRACKING_UPDATED" ? notification.latestEvent : null;
  const { data: result, error } = await supabase.rpc("record_17track_webhook", {
    p_tracking_number: notification.number,
    p_carrier_code: notification.carrier,
    p_tracking_status:
      notification.event === "TRACKING_UPDATED" ? notification.status : null,
    p_latest_event: latestEvent,
    p_delivered: delivered,
    p_delivered_at: delivered ? (latestEvent?.time ?? null) : null,
    p_error: stopped
      ? "17TRACK stopped automatic tracking for this shipment."
      : null,
  });
  if (error) return new Response("Webhook unavailable", { status: 503 });

  if (result?.transitioned_to_delivered) await triggerEmailOutbox();
  return acknowledge({
    processed: Boolean(result?.matched),
    delivered: Boolean(result?.transitioned_to_delivered),
  });
});
