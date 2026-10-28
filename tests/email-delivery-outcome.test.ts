import { describe, it, expect } from "vitest";
import { classifyEmailFailure } from "../lib/email/delivery-outcome";
describe("SMTP retry safety", () => {
  it("retries explicit transient refusals and failures before DATA", () => {
    expect(
      classifyEmailFailure({ responseCode: 451, command: "DATA" }).outcome,
    ).toBe("retry");
    expect(
      classifyEmailFailure({ code: "ETIMEDOUT", command: "CONN" }).outcome,
    ).toBe("retry");
  });
  it("does not retry a permanent recipient refusal", () => {
    expect(
      classifyEmailFailure({ responseCode: 550, command: "RCPT TO" }).outcome,
    ).toBe("permanent");
  });
  it("quarantines uncertain acceptance instead of duplicating messages", () => {
    expect(
      classifyEmailFailure({ code: "ETIMEDOUT", command: "DATA" }).outcome,
    ).toBe("ambiguous");
    expect(
      classifyEmailFailure(new Error("unknown network outcome")).outcome,
    ).toBe("ambiguous");
  });
  it("does not expose provider response bodies or credentials in diagnostics", () => {
    expect(
      classifyEmailFailure({
        code: "EAUTH",
        command: "AUTH",
        responseCode: 535,
        response: "secret private response",
      }).diagnostic,
    ).not.toContain("secret");
  });
});
