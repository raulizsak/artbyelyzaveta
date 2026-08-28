import { afterEach, describe, expect, it } from "vitest";
import {
  createPreviewCookieValue,
  hasValidPreviewCookie,
  isCorrectPreviewPassword,
  safePreviewNext,
} from "../lib/preview";

const originalPassword = process.env.PREVIEW_PASSWORD;
const originalSecret = process.env.PREVIEW_COOKIE_SECRET;

afterEach(() => {
  process.env.PREVIEW_PASSWORD = originalPassword;
  process.env.PREVIEW_COOKIE_SECRET = originalSecret;
});

describe("private preview access", () => {
  it("accepts only the configured password", async () => {
    process.env.PREVIEW_PASSWORD = "private-test-password";
    expect(await isCorrectPreviewPassword("private-test-password")).toBe(true);
    expect(await isCorrectPreviewPassword("incorrect")).toBe(false);
  });

  it("signs and verifies an opaque access cookie", async () => {
    process.env.PREVIEW_COOKIE_SECRET = "a-long-test-only-signing-secret";
    const cookie = await createPreviewCookieValue();
    expect(cookie).toMatch(/^v1\./);
    expect(cookie).not.toContain("a-long-test-only-signing-secret");
    expect(await hasValidPreviewCookie(cookie)).toBe(true);
    expect(await hasValidPreviewCookie(`${cookie}tampered`)).toBe(false);
  });

  it("rejects external redirect targets", () => {
    expect(safePreviewNext("/account/orders?view=current")).toBe(
      "/account/orders?view=current",
    );
    expect(safePreviewNext("https://example.com")).toBe("/home");
    expect(safePreviewNext("//example.com")).toBe("/home");
  });
});
