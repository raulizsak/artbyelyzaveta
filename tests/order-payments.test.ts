import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expireUnpaidOrderSession,
  getOrderStripe,
} from "../lib/stripe/order-payments";

const mocks = vi.hoisted(() => ({
  stripe: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/server", () => ({ getStripe: mocks.stripe }));

const order = {
  id: "order-id",
  stripe_mode: "test",
  stripe_checkout_session_id: "cs_test_order",
};
const session = (status: string, payment_status = "unpaid") => ({
  status,
  payment_status,
  livemode: false,
  metadata: { order_id: order.id },
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.stripe.mockReturnValue({
    checkout: { sessions: { retrieve: mocks.retrieve, expire: mocks.expire } },
  });
  mocks.retrieve.mockResolvedValue(session("open"));
  mocks.expire.mockResolvedValue(session("expired"));
});

describe("order Stripe account isolation and safe cancellation", () => {
  it("blocks cancellation while the checkout session is not yet attached", async () => {
    await expect(
      expireUnpaidOrderSession({ ...order, stripe_checkout_session_id: null }),
    ).rejects.toThrow("verified Stripe checkout session");
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
  it.each(["test", "live"])(
    "uses an existing order's %s account independently of active checkout",
    (stripe_mode) => {
      getOrderStripe({ ...order, stripe_mode });
      expect(mocks.stripe).toHaveBeenCalledWith(stripe_mode, false);
    },
  );
  it.each([null, "", "demo", "unknown"])(
    "rejects unverified mode %s without falling back to live",
    (stripe_mode) => {
      expect(() => getOrderStripe({ ...order, stripe_mode })).toThrow(
        "verified Stripe mode",
      );
      expect(mocks.stripe).not.toHaveBeenCalled();
    },
  );
  it("expires an open unpaid session before allowing the database cancellation", async () => {
    await expireUnpaidOrderSession(order);
    expect(mocks.expire).toHaveBeenCalledWith(order.stripe_checkout_session_id);
  });
  it("accepts an already expired unpaid session without sending a second expiry", async () => {
    mocks.retrieve.mockResolvedValue(session("expired"));
    await expireUnpaidOrderSession(order);
    expect(mocks.expire).not.toHaveBeenCalled();
  });
  it.each(["paid", "unpaid"])(
    "blocks completed %s sessions, including asynchronous payment",
    async (paymentStatus) => {
      mocks.retrieve.mockResolvedValue(session("complete", paymentStatus));
      await expect(expireUnpaidOrderSession(order)).rejects.toThrow(
        "unresolved",
      );
      expect(mocks.expire).not.toHaveBeenCalled();
    },
  );
  it("does not treat a temporary expiry error as permission to release stock", async () => {
    mocks.expire.mockRejectedValue(new Error("Timeout"));
    await expect(expireUnpaidOrderSession(order)).rejects.toThrow("unresolved");
  });
  it("handles an expiry race only after reading back confirmed expiration", async () => {
    mocks.expire.mockRejectedValue(new Error("Already expired"));
    mocks.retrieve
      .mockResolvedValueOnce(session("open"))
      .mockResolvedValueOnce(session("expired"));
    await expireUnpaidOrderSession(order);
    expect(mocks.retrieve).toHaveBeenCalledTimes(2);
  });
  it("blocks a payment that completes during cancellation", async () => {
    mocks.expire.mockRejectedValue(new Error("Already complete"));
    mocks.retrieve
      .mockResolvedValueOnce(session("open"))
      .mockResolvedValueOnce(session("complete", "paid"));
    await expect(expireUnpaidOrderSession(order)).rejects.toThrow("unresolved");
  });
  it.each(["mode", "order"])(
    "does not expire a session with a different %s",
    async (mismatch) => {
      mocks.retrieve.mockResolvedValue({
        ...session("open"),
        ...(mismatch === "mode"
          ? { livemode: true }
          : { metadata: { order_id: "someone-else" } }),
      });
      await expect(expireUnpaidOrderSession(order)).rejects.toThrow(
        "does not match",
      );
      expect(mocks.expire).not.toHaveBeenCalled();
    },
  );
});
