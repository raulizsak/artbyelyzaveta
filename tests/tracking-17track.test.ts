import { describe, expect, it, vi } from "vitest";
import { formatTrackingStatus } from "@/lib/presentation";
import {
  AUSTRALIA_POST_CARRIER_CODE,
  australiaPostTrackingUrl,
  isWebhookOrderMatch,
  parse17TrackWebhook,
  registerAustraliaPostTracking,
  sha256Hex,
  shouldRegisterOrder,
  trackingStatuses,
  verify17TrackSignature,
} from "@/supabase/functions/tracking-webhook/seventeen-track";

const registrationOrder = {
  deliveryMethod: "shipping",
  fulfillmentStatus: "shipped",
  isDemo: false,
  orderStatus: "confirmed",
  trackingCarrier: "Australia Post",
  trackingNumber: "33ABC1234567",
};

const webhookBody = (status = "InTransit", number = "33ABC1234567") =>
  JSON.stringify({
    event: "TRACKING_UPDATED",
    data: {
      number,
      carrier: AUSTRALIA_POST_CARRIER_CODE,
      track_info: {
        latest_status: {
          status,
          sub_status: `${status}_Other`,
          sub_status_descr: null,
        },
        latest_event: {
          time_iso: "2026-10-02T10:30:00+10:00",
          time_utc: "2026-10-02T00:30:00Z",
          description: "Processed at facility",
          location: "Sydney NSW",
          stage: status,
          sub_status: `${status}_Other`,
          address: { street: "must not be stored" },
        },
      },
    },
  });

describe("17TRACK registration", () => {
  it("registers Australia Post with carrier code 1151 and no customer data", async () => {
    const fetcher = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json({
        code: 0,
        data: {
          accepted: [
            { number: registrationOrder.trackingNumber, carrier: 1151 },
          ],
          rejected: [],
        },
      });
    });

    const result = await registerAustraliaPostTracking(
      fetcher,
      "test-security-key",
      registrationOrder.trackingNumber,
    );

    expect(result).toEqual({ ok: true, alreadyRegistered: false, error: null });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.17track.net/track/v2.4/register");
    expect(JSON.parse(String(init?.body))).toEqual([
      { number: "33ABC1234567", carrier: 1151 },
    ]);
    expect(String(init?.body)).not.toMatch(/email|phone|address|customer/i);
  });

  it("treats the documented already-registered response as success", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        code: 0,
        data: {
          accepted: [],
          rejected: [
            {
              number: registrationOrder.trackingNumber,
              carrier: 1151,
              error: { code: -18019901, message: "already registered" },
            },
          ],
        },
      }),
    );
    await expect(
      registerAustraliaPostTracking(
        fetcher,
        "test-security-key",
        registrationOrder.trackingNumber,
      ),
    ).resolves.toEqual({ ok: true, alreadyRegistered: true, error: null });
  });

  it("returns a safe error for provider failure", async () => {
    const fetcher = vi.fn(
      async () => new Response("unavailable", { status: 503 }),
    );
    await expect(
      registerAustraliaPostTracking(
        fetcher,
        "test-security-key",
        registrationOrder.trackingNumber,
      ),
    ).resolves.toEqual({
      ok: false,
      alreadyRegistered: false,
      error: "17TRACK is temporarily unavailable.",
    });
  });

  it.each([
    [{ ...registrationOrder, deliveryMethod: "collection" }, "collection"],
    [{ ...registrationOrder, isDemo: true }, "demo"],
    [{ ...registrationOrder, trackingNumber: "" }, "missing number"],
    [{ ...registrationOrder, fulfillmentStatus: "preparing" }, "not shipped"],
  ])("does not register an ineligible %s order", (order) => {
    expect(shouldRegisterOrder(order)).toBe(false);
  });

  it("builds the supported Australia Post public tracking URL", () => {
    expect(australiaPostTrackingUrl(" 33abc1234567 ")).toBe(
      "https://auspost.com.au/track/33ABC1234567",
    );
  });
});

describe("17TRACK webhook security and parsing", () => {
  it("accepts a valid raw-body signature and rejects an invalid one", async () => {
    const raw = webhookBody();
    const key = "test-security-key";
    const signature = await sha256Hex(`${raw}/${key}`);
    await expect(verify17TrackSignature(raw, key, signature)).resolves.toBe(
      true,
    );
    await expect(
      verify17TrackSignature(raw, key, "0".repeat(64)),
    ).resolves.toBe(false);
  });

  it("rejects malformed JSON and incomplete payloads", () => {
    expect(parse17TrackWebhook("not-json")).toBeNull();
    expect(
      parse17TrackWebhook(JSON.stringify({ event: "TRACKING_UPDATED" })),
    ).toBeNull();
  });

  it.each(trackingStatuses)("parses the structured %s status", (status) => {
    const result = parse17TrackWebhook(webhookBody(status));
    expect(result).toMatchObject({
      event: "TRACKING_UPDATED",
      number: "33ABC1234567",
      carrier: 1151,
      status,
      latestEvent: {
        description: "Processed at facility",
        location: "Sydney NSW",
        stage: status,
        time: "2026-10-02T00:30:00.000Z",
      },
    });
    expect(result).not.toHaveProperty("data.track_info.latest_event.address");
  });

  it("parses TRACKING_STOPPED without treating it as delivered", () => {
    expect(
      parse17TrackWebhook(
        JSON.stringify({
          event: "TRACKING_STOPPED",
          data: { number: "33ABC1234567", carrier: 1151 },
        }),
      ),
    ).toEqual({
      event: "TRACKING_STOPPED",
      number: "33ABC1234567",
      carrier: 1151,
    });
  });

  const matchingOrder = {
    delivery_method: "shipping",
    fulfillment_status: "shipped",
    is_demo: false,
    order_status: "confirmed",
    tracking_carrier_code: 1151,
    tracking_number: "33ABC1234567",
    tracking_provider: "17track",
  };

  it("matches only the current tracking number and expected provider", () => {
    expect(
      isWebhookOrderMatch(matchingOrder, {
        number: "33ABC1234567",
        carrier: 1151,
      }),
    ).toBe(true);
    expect(
      isWebhookOrderMatch(matchingOrder, {
        number: "OLD12345678",
        carrier: 1151,
      }),
    ).toBe(false);
    expect(
      isWebhookOrderMatch(
        { ...matchingOrder, tracking_provider: null },
        { number: "33ABC1234567", carrier: 1151 },
      ),
    ).toBe(false);
  });

  it("ignores collection, demo, cancelled, and refunded orders", () => {
    for (const order of [
      { ...matchingOrder, delivery_method: "collection" },
      { ...matchingOrder, is_demo: true },
      { ...matchingOrder, order_status: "cancelled" },
      { ...matchingOrder, order_status: "refunded" },
    ])
      expect(
        isWebhookOrderMatch(order, {
          number: "33ABC1234567",
          carrier: 1151,
        }),
      ).toBe(false);
  });
});

describe("tracking presentation", () => {
  it.each([
    ["NotFound", "Not found"],
    ["InfoReceived", "Info received"],
    ["InTransit", "In transit"],
    ["AvailableForPickup", "Available for pickup"],
    ["OutForDelivery", "Out for delivery"],
    ["DeliveryFailure", "Delivery failed"],
    ["Delivered", "Delivered"],
  ])("formats %s as %s", (status, label) => {
    expect(formatTrackingStatus(status)).toBe(label);
  });
});
