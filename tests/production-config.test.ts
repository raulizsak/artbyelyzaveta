import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPaymentMode, isStripeCheckoutEnabled } from "../lib/env";
afterEach(() => vi.unstubAllEnvs());
describe("production payment fail-closed configuration", () => {
  it.each([undefined, "", "typo", "demo"])(
    "disables checkout for %s in production",
    (mode) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PAYMENT_MODE", mode);
      vi.stubEnv("ENABLE_DEMO_CHECKOUT", "true");
      expect(getPaymentMode()).toBe("disabled");
      expect(isStripeCheckoutEnabled()).toBe(false);
    },
  );
  it("requires explicit opt-in for isolated local demo mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PAYMENT_MODE", "demo");
    vi.stubEnv("ENABLE_DEMO_CHECKOUT", "false");
    expect(getPaymentMode()).toBe("disabled");
    vi.stubEnv("ENABLE_DEMO_CHECKOUT", "true");
    expect(getPaymentMode()).toBe("demo");
  });
});
