import { describe, expect, it } from "vitest";
import { formatMoney, paintingDimensions } from "../lib/catalog";
import { LOCAL_CATALOGUE_FIXTURE } from "../lib/catalog-fixture";
import { POLICIES } from "../lib/policies";

describe("the Phase 1 catalogue", () => {
  it("contains exactly one unique original", () => {
    expect(LOCAL_CATALOGUE_FIXTURE).toHaveLength(1);
    expect(
      new Set(LOCAL_CATALOGUE_FIXTURE.map((painting) => painting.slug)).size,
    ).toBe(1);
    expect(LOCAL_CATALOGUE_FIXTURE[0].status).toBe("available");
  });

  it("keeps the verified artwork facts intact", () => {
    const painting = LOCAL_CATALOGUE_FIXTURE[0];
    expect(formatMoney(painting.priceCents)).toBe("$1,370");
    expect(paintingDimensions(painting)).toBe("90 × 60 × 1 cm");
    expect(painting.readyToHang).toBe(true);
    expect(painting.certificate).toBe(true);
    expect(painting.framed).toBe(false);
    expect(painting.media).toHaveLength(5);
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
