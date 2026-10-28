import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.create } }));
import { sendTransactionalEmail } from "../lib/email/transport";
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    SMTP2GO_SMTP_HOST: "smtp.example.test",
    SMTP2GO_SMTP_PORT: "443",
    SMTP2GO_SMTP_USER: "isolated-fixture",
    SMTP2GO_SMTP_PASSWORD: "isolated-fixture",
    EMAIL_FROM: "Gallery <hello@example.test>",
    EMAIL_DELIVERY_MODE: "test",
    EMAIL_TEST_RECIPIENT: "qa@example.test",
  }))
    vi.stubEnv(key, value);
  mocks.create.mockReturnValue({ sendMail: mocks.send });
  mocks.send.mockResolvedValue({ messageId: "local-boundary-only" });
});
afterEach(() => vi.unstubAllEnvs());
describe("SMTP2GO transport boundary (no external sends)", () => {
  it("isolates test recipients and retains TLS and branded payloads", async () => {
    expect(
      await sendTransactionalEmail({
        to: "customer@example.test",
        subject: "Order confirmation",
        html: "<p>Art by Elyzaveta</p>",
        text: "Art by Elyzaveta",
      }),
    ).toBe("local-boundary-only");
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "qa@example.test",
        subject: "[TEST for customer@example.test] Order confirmation",
      }),
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true,
        port: 443,
        tls: { minVersion: "TLSv1.2" },
      }),
    );
  });
  it("fails without a safe recipient instead of falling back to the customer", async () => {
    vi.stubEnv("EMAIL_TEST_RECIPIENT", "");
    await expect(
      sendTransactionalEmail({
        to: "customer@example.test",
        subject: "Order",
        html: "",
        text: "",
      }),
    ).rejects.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("surfaces a provider failure so the outbox can retry", async () => {
    mocks.send.mockRejectedValue(new Error("Isolated provider outage"));
    await expect(
      sendTransactionalEmail({
        to: "customer@example.test",
        subject: "Order",
        html: "",
        text: "",
      }),
    ).rejects.toThrow("Isolated provider outage");
  });
});
