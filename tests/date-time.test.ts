import { describe, expect, it } from "vitest";
import {
  formatMelbourneDateTime,
  MELBOURNE_TIME_ZONE,
  melbourneDateTimeLocalToIso,
  toMelbourneDateTimeLocal,
} from "../lib/date-time";

describe("Melbourne date formatting", () => {
  it("uses daylight saving time in summer", () => {
    const formatted = formatMelbourneDateTime("2026-01-14T14:30:00Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    expect(MELBOURNE_TIME_ZONE).toBe("Australia/Melbourne");
    expect(formatted).toContain("15 Jan 2026");
    expect(formatted).toContain("1:30 am");
    expect(formatted).toContain("AEDT");
  });

  it("uses standard time in winter", () => {
    const formatted = formatMelbourneDateTime("2026-07-14T14:30:00Z", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    expect(formatted).toContain("15 July 2026");
    expect(formatted).toContain("12:30 am");
    expect(formatted).toContain("AEST");
  });

  it("round-trips discount dates in Melbourne across daylight saving", () => {
    expect(melbourneDateTimeLocalToIso("2026-09-01T09:30")).toBe(
      "2026-08-31T23:30:00.000Z",
    );
    expect(toMelbourneDateTimeLocal("2026-12-14T22:15:00.000Z")).toBe(
      "2026-12-15T09:15",
    );
  });
});
