import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/stripe/webhook/route";

const mocks = vi.hoisted(() => ({
  event: vi.fn(),
  rpc: vi.fn(),
  items: vi.fn(),
  sync: vi.fn(),
  email: vi.fn(),
  invoice: vi.fn(),
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripe: () => ({ webhooks: { constructEvent: mocks.event } }),
}));
vi.mock("@/lib/stripe/catalog", () => ({ syncPaintingCatalog: mocks.sync }));
vi.mock("@/lib/stripe/invoices", () => ({
  ensureStripeInvoiceForOrder: mocks.invoice,
}));
vi.mock("@/lib/email/outbox", () => ({ triggerEmailOutbox: mocks.email }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ not: mocks.items }) }) }),
  }),
}));

const refundEvent = {
  id: "evt_refund",
  type: "refund.updated",
  livemode: false,
  data: {
    object: {
      object: "refund",
      id: "re_refund",
      metadata: { order_id: "order-id" },
      payment_intent: "pi_original",
      amount: 34000,
      status: "succeeded",
    },
  },
};
const request = () =>
  new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "signed-event" },
    body: "{}",
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("STRIPE_LIVE_WEBHOOK_SECRET", "");
  mocks.event.mockReturnValue(refundEvent);
  mocks.rpc.mockResolvedValue({
    data: { status: "processed", order_id: "order-id" },
  });
  mocks.items.mockResolvedValue({ data: [{ painting_id: "painting-id" }] });
  mocks.sync.mockResolvedValue([
    { mode: "test", status: "synced" },
    { mode: "live", status: "synced" },
  ]);
});

describe("Stripe inventory webhook side effects", () => {
  it("syncs both catalogues from authoritative inventory after a refund", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith("painting-id");
    expect(mocks.email).toHaveBeenCalledWith("order-id");
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it("retries failed catalogue sync without repeating order emails", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "duplicate" } });
    mocks.sync.mockResolvedValue([{ mode: "live", status: "error" }]);
    expect((await POST(request())).status).toBe(500);
    expect(mocks.sync).toHaveBeenCalledWith("painting-id");
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("uses the database-resolved order when refund metadata is absent", async () => {
    mocks.event.mockReturnValue({
      ...refundEvent,
      data: { object: { ...refundEvent.data.object, metadata: {} } },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith("painting-id");
  });

  it("does not sync failed or ignored database events", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "failed" } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.sync).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: { status: "ignored" } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature before changing anything", async () => {
    mocks.event.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("syncs catalogue and creates a Stripe invoice after paid checkout", async () => {
    mocks.event.mockReturnValue({
      id: "evt_paid",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          object: "checkout.session",
          id: "cs_test_order",
          metadata: { order_id: "order-id" },
          payment_status: "paid",
          amount_total: 34000,
          currency: "aud",
          payment_intent: "pi_original",
        },
      },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith("painting-id");
    expect(mocks.invoice).toHaveBeenCalledWith("order-id", "test");
  });
});
