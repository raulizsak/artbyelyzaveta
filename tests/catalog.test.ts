import { describe, expect, it } from "vitest";
import {
  COWS_AT_DUSK,
  PAINTINGS,
  formatMoney,
  paintingDimensions,
} from "../lib/catalog";
import { POLICIES } from "../lib/policies";

describe("the Phase 1 catalogue", () => {
  it("contains exactly one unique original", () => {
    expect(PAINTINGS).toHaveLength(1);
    expect(new Set(PAINTINGS.map((painting) => painting.slug)).size).toBe(1);
    expect(COWS_AT_DUSK.status).toBe("available");
  });

  it("keeps the verified artwork facts intact", () => {
    expect(formatMoney(COWS_AT_DUSK.price)).toBe("$1,370");
    expect(paintingDimensions(COWS_AT_DUSK)).toBe("90 × 60 × 1 cm");
    expect(COWS_AT_DUSK.readyToHang).toBe(true);
    expect(COWS_AT_DUSK.certificate).toBe(true);
    expect(COWS_AT_DUSK.framed).toBe(false);
    expect(COWS_AT_DUSK.media).toHaveLength(5);
  });

  it("publishes all required policy documents with the supplied update date", () => {
    expect(POLICIES).toHaveLength(6);
    expect(
      POLICIES.every((policy) => policy.updated === "21 August 2026"),
    ).toBe(true);
    expect(
      POLICIES.find((policy) => policy.slug === "returns-and-refunds")?.content,
    ).toContain("Australian Consumer Law");
  });
});
