// @ts-nocheck -- Supabase Edge Functions are checked by Deno.
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

type TrackingEvent = { description: string; location?: string; date?: string };
type TrackingResult = {
  tracking_id: string;
  status?: string;
  errors?: { code?: string; name?: string; message?: string }[];
  consignment?: { status?: string; events?: TrackingEvent[] };
  trackable_items?: Array<{
    status?: string;
    events?: TrackingEvent[];
    items?: Array<{ status?: string; events?: TrackingEvent[] }>;
  }>;
};

type TrackedOrder = {
  id: string;
  tracking_carrier: string | null;
  tracking_number: string;
  tracking_url: string | null;
};

type CarrierUpdate = {
  trackingId: string;
  status: string;
  latestEvent: TrackingEvent | null;
  delivered: boolean;
  deliveredAt: string | null;
  error: string | null;
};

interface TrackingProvider {
  canTrack(order: TrackedOrder): boolean;
  track(orders: TrackedOrder[]): Promise<CarrierUpdate[]>;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cronSecret = Deno.env.get("TRACKING_CRON_SECRET") ?? "";
const australiaPostKey = Deno.env.get("AUSTRALIA_POST_API_KEY") ?? "";
const australiaPostPassword =
  Deno.env.get("AUSTRALIA_POST_API_PASSWORD") ?? "";
const australiaPostAccount =
  Deno.env.get("AUSTRALIA_POST_ACCOUNT_NUMBER") ?? "";
const renderEmailUrl = Deno.env.get("RENDER_EMAIL_OUTBOX_URL") ?? "";
const renderEmailSecret = Deno.env.get("RENDER_EMAIL_OUTBOX_SECRET") ?? "";
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const safeEqual = async (left: string, right: string) => {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return new Uint8Array(a).every(
    (value, index) => value === new Uint8Array(b)[index],
  );
};

const eventsFrom = (result: TrackingResult) => {
  const events: TrackingEvent[] = [...(result.consignment?.events ?? [])];
  for (const item of result.trackable_items ?? []) {
    events.push(...(item.events ?? []));
    for (const nested of item.items ?? []) events.push(...(nested.events ?? []));
  }
  return events.sort(
    (a, b) =>
      new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
  );
};

const statusFrom = (result: TrackingResult) => {
  const statuses = [
    result.status,
    result.consignment?.status,
    ...(result.trackable_items ?? []).flatMap((item) => [
      item.status,
      ...(item.items ?? []).map((nested) => nested.status),
    ]),
  ].filter(Boolean) as string[];
  return statuses[0] ?? eventsFrom(result)[0]?.description ?? "In transit";
};

class AustraliaPostProvider implements TrackingProvider {
  canTrack(order: TrackedOrder) {
    const carrier = order.tracking_carrier?.toLowerCase() ?? "";
    const url = order.tracking_url?.toLowerCase() ?? "";
    return (
      carrier.includes("australia post") ||
      carrier.includes("auspost") ||
      url.includes("auspost.com.au") ||
      /AU$/i.test(order.tracking_number)
    );
  }

  async track(orders: TrackedOrder[]) {
    if (!australiaPostKey || !australiaPostPassword || !australiaPostAccount)
      throw new Error("Australia Post tracking credentials are not configured.");
    const updates: CarrierUpdate[] = [];
    for (let offset = 0; offset < orders.length; offset += 10) {
      if (offset) await wait(6100);
      const batch = orders.slice(offset, offset + 10);
      const trackingIds = batch.map((order) => order.tracking_number);
      const response = await fetch(
        `https://digitalapi.auspost.com.au/shipping/v1/track?tracking_ids=${encodeURIComponent(trackingIds.join(","))}`,
        {
          headers: {
            Accept: "application/json",
            "Account-Number": australiaPostAccount,
            Authorization: `Basic ${btoa(`${australiaPostKey}:${australiaPostPassword}`)}`,
          },
        },
      );
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new Error(
          retryable
            ? "Australia Post tracking is temporarily unavailable."
            : "Australia Post rejected the tracking request.",
        );
      }
      const body = await response.json();
      const byId = new Map<string, TrackingResult>(
        (body.tracking_results ?? []).map((result: TrackingResult) => [
          result.tracking_id,
          result,
        ]),
      );
      for (const order of batch) {
        const result = byId.get(order.tracking_number);
        const latestEvent = result ? eventsFrom(result)[0] ?? null : null;
        const status = result ? statusFrom(result) : "Tracking unavailable";
        const delivered = /\b(delivered|delivered in full|item delivered)\b/i.test(
          [status, latestEvent?.description].filter(Boolean).join(" "),
        );
        const providerError = result?.errors?.[0];
        updates.push({
          trackingId: order.tracking_number,
          status,
          latestEvent,
          delivered,
          deliveredAt: delivered ? latestEvent?.date ?? null : null,
          error: providerError
            ? providerError.message ?? providerError.name ?? "Tracking unavailable"
            : result
              ? null
              : "No tracking result was returned.",
        });
      }
    }
    return updates;
  }
}

const providers: TrackingProvider[] = [new AustraliaPostProvider()];

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const supplied = request.headers.get("x-tracking-cron-secret") ?? "";
  if (!cronSecret || !(await safeEqual(supplied, cronSecret)))
    return new Response("Unauthorized", { status: 401 });

  const dueAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id, tracking_carrier, tracking_number, tracking_url")
    .eq("fulfillment_status", "shipped")
    .not("tracking_number", "is", null)
    .or(`next_tracking_check_at.is.null,next_tracking_check_at.lte.${dueAt}`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return new Response("Tracking queue unavailable", { status: 503 });

  const orders = (data ?? []) as TrackedOrder[];
  let processed = 0;
  let delivered = 0;
  for (const provider of providers) {
    const supported = orders.filter((order) => provider.canTrack(order));
    if (!supported.length) continue;
    try {
      const updates = await provider.track(supported);
      for (const update of updates) {
        const order = supported.find(
          (entry) => entry.tracking_number === update.trackingId,
        );
        if (!order) continue;
        const { data: result } = await supabase.rpc("record_tracking_result", {
          p_order_id: order.id,
          p_tracking_status: update.status,
          p_latest_event: update.latestEvent,
          p_delivered: update.delivered,
          p_delivered_at: update.deliveredAt,
          p_error: update.error,
          p_next_check_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
        processed += 1;
        if (result?.transitioned_to_delivered) delivered += 1;
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Tracking is temporarily unavailable.";
      for (const order of supported) {
        await supabase.rpc("record_tracking_result", {
          p_order_id: order.id,
          p_tracking_status: null,
          p_latest_event: null,
          p_delivered: false,
          p_delivered_at: null,
          p_error: message,
          p_next_check_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }
    }
  }

  if (renderEmailUrl && renderEmailSecret) {
    await fetch(renderEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-email-outbox-secret": renderEmailSecret,
      },
      body: JSON.stringify({ source: "tracking-check" }),
    }).catch(() => undefined);
  }
  return Response.json({ checked: processed, delivered });
});
