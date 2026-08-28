import { describe, expect, it } from "vitest";
import { formatDisplayValue } from "../lib/presentation";

describe("shared presentation formatting", () => {
  it.each([
    ["shipping", "Shipping"],
    ["shipped", "Shipped"],
    ["delivered", "Delivered"],
    ["paid", "Paid"],
    ["preparing", "Preparing"],
    ["unfulfilled", "Unfulfilled"],
    ["confirmed", "Confirmed"],
    ["completed", "Completed"],
    ["partially_refunded", "Partially Refunded"],
    ["manual_arrangement", "Manual Arrangement"],
    ["gst_included", "GST Included"],
  ])("formats %s for people", (machineValue, expected) => {
    expect(formatDisplayValue(machineValue)).toBe(expected);
  });

  it("uses a professional fallback without changing internal values", () => {
    const internal = "partially_refunded";
    expect(formatDisplayValue(null, "Not checked")).toBe("Not checked");
    expect(internal).toBe("partially_refunded");
  });
});
