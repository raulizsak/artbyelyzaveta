/** Pure 17TRACK protocol helpers shared by the Edge Function and Render app. */
export const AUSTRALIA_POST_CARRIER_CODE = 1151;
export const SEVENTEEN_TRACK_API_BASE = "https://api.17track.net/track/v2.4";

export const trackingStatuses = [
  "NotFound",
  "InfoReceived",
  "InTransit",
  "Expired",
  "AvailableForPickup",
  "OutForDelivery",
  "DeliveryFailure",
  "Delivered",
  "Exception",
] as const;

export type TrackingStatus = (typeof trackingStatuses)[number];

export type SafeTrackingEvent = {
  description: string;
  time: string | null;
  location: string | null;
  stage: string | null;
  subStatus: string | null;
};

export type TrackingUpdatedNotification = {
  event: "TRACKING_UPDATED";
  number: string;
  carrier: number;
  status: TrackingStatus;
  latestEvent: SafeTrackingEvent | null;
};

export type TrackingStoppedNotification = {
  event: "TRACKING_STOPPED";
  number: string;
  carrier: number;
};

export type TrackingNotification =
  | TrackingUpdatedNotification
  | TrackingStoppedNotification;

export type RegistrationResult = {
  ok: boolean;
  alreadyRegistered: boolean;
  error: string | null;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type WebhookOrder = {
  delivery_method: string;
  fulfillment_status: string;
  is_demo: boolean;
  order_status: string;
  tracking_carrier_code: number | null;
  tracking_number: string | null;
  tracking_provider: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedString = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, maximum)
    : null;

const safeTime = (value: unknown) => {
  const text = boundedString(value, 50);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return new Date(text).toISOString();
};

export function normalizeTrackingNumber(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isValidTrackingNumber(value: unknown) {
  return /^[A-Z0-9-]{5,50}$/.test(normalizeTrackingNumber(value));
}

export function australiaPostTrackingUrl(value: unknown) {
  const number = normalizeTrackingNumber(value);
  return number
    ? `https://auspost.com.au/track/${encodeURIComponent(number)}`
    : "";
}

export function shouldRegisterOrder(order: {
  deliveryMethod: string;
  fulfillmentStatus: string;
  isDemo: boolean;
  orderStatus: string;
  trackingCarrier: string;
  trackingNumber: string;
}) {
  const carrier = order.trackingCarrier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    order.deliveryMethod === "shipping" &&
    !order.isDemo &&
    order.fulfillmentStatus === "shipped" &&
    !["cancelled", "refunded"].includes(order.orderStatus) &&
    isValidTrackingNumber(order.trackingNumber) &&
    ["", "australiapost", "auspost"].includes(carrier)
  );
}

export function isWebhookOrderMatch(
  order: WebhookOrder,
  notification: Pick<TrackingNotification, "number" | "carrier">,
) {
  return (
    order.delivery_method === "shipping" &&
    !order.is_demo &&
    ["shipped", "delivered"].includes(order.fulfillment_status) &&
    !["cancelled", "refunded"].includes(order.order_status) &&
    order.tracking_provider === "17track" &&
    order.tracking_carrier_code === AUSTRALIA_POST_CARRIER_CODE &&
    notification.carrier === AUSTRALIA_POST_CARRIER_CODE &&
    normalizeTrackingNumber(order.tracking_number) ===
      normalizeTrackingNumber(notification.number)
  );
}

function parseSafeEvent(value: unknown): SafeTrackingEvent | null {
  if (!isRecord(value)) return null;
  const description = boundedString(value.description, 500);
  if (!description) return null;
  return {
    description,
    time: safeTime(value.time_utc) ?? safeTime(value.time_iso),
    location: boundedString(value.location, 200),
    stage: boundedString(value.stage, 100),
    subStatus: boundedString(value.sub_status, 100),
  };
}

export function parse17TrackWebhook(
  rawBody: string,
): TrackingNotification | null {
  if (!rawBody || rawBody.length > 1_000_000) return null;
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!isRecord(body) || !isRecord(body.data)) return null;
  const number = normalizeTrackingNumber(body.data.number);
  const carrier = body.data.carrier;
  if (!isValidTrackingNumber(number) || !Number.isInteger(carrier)) return null;

  if (body.event === "TRACKING_STOPPED") {
    return { event: "TRACKING_STOPPED", number, carrier: carrier as number };
  }
  if (body.event !== "TRACKING_UPDATED" || !isRecord(body.data.track_info))
    return null;
  const statusNode = body.data.track_info.latest_status;
  if (!isRecord(statusNode) || typeof statusNode.status !== "string")
    return null;
  if (!trackingStatuses.includes(statusNode.status as TrackingStatus))
    return null;

  return {
    event: "TRACKING_UPDATED",
    number,
    carrier: carrier as number,
    status: statusNode.status as TrackingStatus,
    latestEvent: parseSafeEvent(body.data.track_info.latest_event),
  };
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function constantTimeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right))
    return false;
  let difference = 0;
  for (let index = 0; index < 64; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verify17TrackSignature(
  rawBody: string,
  securityKey: string,
  signature: string,
) {
  if (!securityKey || !signature) return false;
  const expected = await sha256Hex(`${rawBody}/${securityKey}`);
  return constantTimeHexEqual(expected, signature.trim().toLowerCase());
}

function safeRegistrationError(code: unknown) {
  if (code === -18010012) return "The tracking number format is invalid.";
  if (code === -18019908)
    return "The 17TRACK registration allowance is exhausted.";
  if (code === -18019910)
    return "17TRACK rejected the Australia Post carrier code.";
  if (code === -18019911)
    return "Australia Post tracking cannot be registered at the moment.";
  return "17TRACK could not register this tracking number.";
}

export function interpretRegistrationResponse(
  value: unknown,
): RegistrationResult {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data))
    return {
      ok: false,
      alreadyRegistered: false,
      error: "17TRACK returned an invalid registration response.",
    };
  const accepted = Array.isArray(value.data.accepted)
    ? value.data.accepted
    : [];
  if (accepted.length > 0)
    return { ok: true, alreadyRegistered: false, error: null };
  const rejected = Array.isArray(value.data.rejected)
    ? value.data.rejected
    : [];
  const first = isRecord(rejected[0]) ? rejected[0] : null;
  const error = first && isRecord(first.error) ? first.error : null;
  if (error?.code === -18019901)
    return { ok: true, alreadyRegistered: true, error: null };
  return {
    ok: false,
    alreadyRegistered: false,
    error: safeRegistrationError(error?.code),
  };
}

async function callTrackingApi(
  fetcher: FetchLike,
  apiKey: string,
  endpoint: "register" | "stoptrack",
  trackingNumber: string,
) {
  const number = normalizeTrackingNumber(trackingNumber);
  if (!apiKey || !isValidTrackingNumber(number))
    return {
      ok: false,
      alreadyRegistered: false,
      error: apiKey
        ? "The tracking number format is invalid."
        : "17TRACK is not configured.",
    };
  try {
    const response = await fetcher(`${SEVENTEEN_TRACK_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "17token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ number, carrier: AUSTRALIA_POST_CARRIER_CODE }]),
    });
    if (!response.ok)
      return {
        ok: false,
        alreadyRegistered: false,
        error: "17TRACK is temporarily unavailable.",
      };
    const body = await response.json().catch(() => null);
    return interpretRegistrationResponse(body);
  } catch {
    return {
      ok: false,
      alreadyRegistered: false,
      error: "17TRACK is temporarily unavailable.",
    };
  }
}

export function registerAustraliaPostTracking(
  fetcher: FetchLike,
  apiKey: string,
  trackingNumber: string,
) {
  return callTrackingApi(fetcher, apiKey, "register", trackingNumber);
}

export async function stopAustraliaPostTracking(
  fetcher: FetchLike,
  apiKey: string,
  trackingNumber: string,
) {
  const result = await callTrackingApi(
    fetcher,
    apiKey,
    "stoptrack",
    trackingNumber,
  );
  // "Not registered" and "only tracking numbers can be stopped" are safe
  // idempotent outcomes for a superseded number. The response intentionally
  // is not surfaced to customers or allowed to affect the new registration.
  return result;
}
