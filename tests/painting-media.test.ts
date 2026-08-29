import { describe, expect, it } from "vitest";
import {
  mediaPositionToken,
  parseMediaPositionToken,
} from "../lib/painting-media";

describe("painting media position tokens", () => {
  it("round-trips a stored media position", () => {
    expect(parseMediaPositionToken(mediaPositionToken(12))).toBe(12);
  });

  it("rejects storage paths and malformed values", () => {
    expect(parseMediaPositionToken("paintings/cows-at-dusk")).toBeNull();
    expect(parseMediaPositionToken("position:-1")).toBeNull();
    expect(parseMediaPositionToken("position:1.5")).toBeNull();
  });
});
