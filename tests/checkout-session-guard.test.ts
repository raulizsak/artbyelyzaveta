import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "../app/api/checkout/session/route";

const stripe = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Provider boundary reached");
  }),
);
vi.mock("@/lib/env", () => ({
  getPaymentMode: () => "test",
  isStripeCheckoutEnabled: () => true,
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: async () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/stripe/server", () => ({ getCheckoutStripe: stripe }));
vi.mock("@/lib/stripe/catalog", () => ({
  getCheckoutPriceIds: vi.fn(),
  syncPaintingCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const id = "ae000000-0000-4000-8000-000000000001";
const input = {
  paintingIds: [id],
  firstName: "Private",
  lastName: "Review",
  email: "hello@artbyelyzaveta.shop",
  phone: "0400000000",
  delivery: "collection",
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  country: "Australia",
  notes: "Isolated test",
};
const send = (changes: object) =>
  POST(
    new Request("https://artbyelyzaveta.shop/api/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, ...changes }),
    }),
  );
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("EMAIL_TEST_RECIPIENT", input.email);
  vi.stubEnv("PRELAUNCH_TEST_PAINTING_IDS", id);
  stripe.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unapproved recipients before contacting Stripe", async () => {
  expect((await send({ email: "unapproved@example.test" })).status).toBe(400);
  expect(stripe).not.toHaveBeenCalled();
});
it("protects real artwork inventory from private test payments", async () => {
  expect(
    (await send({ paintingIds: ["ae000000-0000-4000-8000-000000000002"] }))
      .status,
  ).toBe(400);
  expect(stripe).not.toHaveBeenCalled();
});
it("allows only approved isolated artwork through to the provider", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await send({})).status).toBe(503);
  expect(stripe).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
