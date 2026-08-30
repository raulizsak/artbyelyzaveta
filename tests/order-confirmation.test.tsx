import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmationPage from "../app/order-confirmation/page";

const getOrder = vi.hoisted(() => vi.fn());
vi.mock("../lib/orders/confirmation", () => ({
  getOrderForConfirmation: getOrder,
  getOrderForStripeSession: getOrder,
}));
vi.mock("../components/clear-purchased-cart", () => ({
  ClearPurchasedCart: () => <div data-clear-cart="true" />,
}));

beforeEach(() => {
  getOrder.mockReturnValue({
    reference: "ABE-2026-1234567890",
    firstName: "Sandbox",
    email: "checkout@example.com",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    totalCents: 34000,
    currency: "AUD",
    deliveryMethod: "collection",
    isDemo: false,
    item: { title: "Test Artwork", paintingSlug: "test-artwork" },
  });
});

async function renderStatus(paymentStatus: string) {
  const order = getOrder();
  getOrder.mockReturnValue({ ...order, paymentStatus });
  return renderToStaticMarkup(
    await ConfirmationPage({
      searchParams: Promise.resolve({ session_id: "cs_test_regression" }),
    }),
  );
}

describe("payment status recovery", () => {
  it.each(["pending", "processing"])(
    "preserves the bag and avoids claiming success for %s payments",
    async (status) => {
      const html = await renderStatus(status);
      expect(html).not.toContain("data-clear-cart");
      expect(html).not.toContain("Payment confirmed");
      expect(html).toContain("Refresh payment status");
      expect(html).toContain("Please do not submit another payment");
    },
  );

  it.each(["failed", "cancelled"])(
    "shows a recovery path for %s checkout without clearing the bag",
    async (status) => {
      const html = await renderStatus(status);
      expect(html).not.toContain("data-clear-cart");
      expect(html).not.toContain("Refresh payment status");
      expect(html).toContain("No completed payment is recorded");
      expect(html).toContain("Return to your bag");
    },
  );

  it("clears the bag only after payment is confirmed", async () => {
    const html = await renderStatus("paid");
    expect(html).toContain("data-clear-cart");
    expect(html).toContain("Payment confirmed");
    expect(html).not.toContain("Refresh payment status");
  });

  it("formats refund statuses professionally", async () => {
    const html = await renderStatus("partially_refunded");
    expect(html).toContain("Payment Partially Refunded");
    expect(html).not.toContain("data-clear-cart");
    expect(html).not.toContain("Refresh payment status");
  });
});
