import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  order: {} as Record<string, unknown>,
  create: vi.fn(),
  line: vi.fn(),
  finalize: vi.fn(),
  attach: vi.fn(),
  retrieve: vi.fn(),
  save: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe/server", () => ({ getStripe: mocks.stripe }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "orders"
            ? { maybeSingle: async () => ({ data: mocks.order }) }
            : {
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "invoice-row", stripe_invoice_id: null },
                  }),
                }),
              },
      }),
      update: (data: unknown) => {
        mocks.save(data);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
import { ensureStripeInvoiceForOrder } from "../lib/stripe/invoices";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.order = {
    id: "order-local",
    order_reference: "ABE-2026-AABBCCDDEE",
    customer_email: "qa@example.test",
    customer_first_name: "Local",
    customer_last_name: "QA",
    delivery_method: "shipping",
    currency: "AUD",
    discount_cents: 10000,
    shipping_cents: 2500,
    tax_cents: 0,
    total_cents: 92500,
    payment_status: "paid",
    stripe_mode: "test",
    stripe_customer_id: "cus_test_local",
    stripe_payment_intent_id: "pi_test_local",
    order_items: [
      {
        id: "item-local",
        title: "Isolated artwork",
        dimensions: "80 × 60 cm",
        medium: "Oil",
        quantity: 1,
        line_total_cents: 100000,
      },
    ],
    order_discounts: [{ code: "LOCAL10", applied_cents: 10000 }],
  };
  const base = {
    id: "in_test_local",
    number: "LOCAL-001",
    amount_due: 92500,
    status_transitions: { finalized_at: 1 },
    invoice_pdf: "https://example.test/invoice.pdf",
  };
  mocks.create.mockResolvedValue({
    ...base,
    status: "draft",
    amount_remaining: 92500,
  });
  mocks.finalize.mockResolvedValue({
    ...base,
    status: "open",
    amount_remaining: 92500,
  });
  mocks.attach.mockResolvedValue({
    ...base,
    status: "paid",
    amount_remaining: 0,
  });
  mocks.retrieve.mockResolvedValue({
    ...base,
    status: "paid",
    amount_remaining: 0,
  });
  mocks.line.mockResolvedValue({ id: "ii_test_local" });
  mocks.stripe.mockReturnValue({
    invoices: {
      create: mocks.create,
      finalizeInvoice: mocks.finalize,
      attachPayment: mocks.attach,
      retrieve: mocks.retrieve,
    },
    invoiceItems: { create: mocks.line },
  });
});
describe("Stripe invoice provider boundary (no Stripe requests)", () => {
  it("reconciles artwork, discount and shipping with stable retry keys", async () => {
    await ensureStripeInvoiceForOrder("order-local", "test");
    expect(mocks.line.mock.calls.map(([data]) => data.amount)).toEqual([
      100000, -10000, 2500,
    ]);
    expect(
      mocks.line.mock.calls.every(
        ([data]) => data.currency === "aud" && data.discountable === false,
      ),
    ).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_advance: false,
        collection_method: "send_invoice",
      }),
      { idempotencyKey: "invoice-test-order-local" },
    );
    expect(mocks.attach).toHaveBeenCalledWith(
      "in_test_local",
      { payment_intent: "pi_test_local" },
      { idempotencyKey: "invoice-payment-test-order-local" },
    );
  });
  it("refuses financial mismatches before attaching the paid transaction", async () => {
    mocks.finalize.mockResolvedValue({
      id: "in_test_local",
      status: "open",
      amount_due: 1,
      amount_remaining: 1,
    });
    await expect(
      ensureStripeInvoiceForOrder("order-local", "test"),
    ).rejects.toThrow("total does not match");
    expect(mocks.attach).not.toHaveBeenCalled();
  });
  it("refuses unpaid orders and a different environment", async () => {
    mocks.order.payment_status = "pending";
    await expect(
      ensureStripeInvoiceForOrder("order-local", "test"),
    ).rejects.toThrow("paid order");
    mocks.order.payment_status = "paid";
    await expect(
      ensureStripeInvoiceForOrder("order-local", "live"),
    ).rejects.toThrow("does not match");
    expect(mocks.stripe).not.toHaveBeenCalled();
  });
});
