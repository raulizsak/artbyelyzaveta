import { describe, expect, it } from "vitest";
import { paymentDiagnostic } from "../lib/stripe/payment-diagnostic";

describe("payment diagnostics", () => {
  it("keeps the actionable exception without serializing other fields", () => {
    expect(
      paymentDiagnostic({
        name: "IntegrationError",
        message: "Missing required field: billingAddress.",
        cvc: "123",
        card: "4242424242424242",
      }),
    ).toBe("IntegrationError: Missing required field: billingAddress.");
  });

  it("redacts secrets, email and card-like numbers embedded in a message", () => {
    const result = paymentDiagnostic(
      new Error(
        "sk_test_fake cs_test_example_secret_example test@example.com 4242 4242 4242 4242",
      ),
    );
    expect(result).not.toContain("sk_test_");
    expect(result).not.toContain("_secret_");
    expect(result).not.toContain("test@example.com");
    expect(result).not.toContain("4242");
  });

  it("does not stringify arbitrary objects", () => {
    expect(paymentDiagnostic({ card: "secret" })).toBe(
      "PaymentError: Stripe returned an unexpected error.",
    );
  });
});
