import { beforeEach, describe, expect, it } from "vitest";
import {
  CAPABILITY_ROUTE,
  parseCapabilityHash,
  formatCapabilityHash,
} from "../src/shell/useCapabilityRoute";

describe("capability hash", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("uses the route decision 13 specifies", () => {
    expect(CAPABILITY_ROUTE).toBe("#capabilities");
  });

  it("reads the capability id out of the hash", () => {
    expect(parseCapabilityHash("#capabilities/templates")).toBe("templates");
  });

  it("falls back to the first registered capability for a bare route", () => {
    expect(parseCapabilityHash("#capabilities")).toBe("saved-blocks");
  });

  it("falls back for an unregistered id rather than rendering nothing", () => {
    expect(parseCapabilityHash("#capabilities/not-a-capability")).toBe(
      "saved-blocks",
    );
  });

  it("round-trips an id through format and parse", () => {
    expect(parseCapabilityHash(formatCapabilityHash("comments"))).toBe(
      "comments",
    );
  });

  it("formats a shareable hash", () => {
    expect(formatCapabilityHash("comments")).toBe("#capabilities/comments");
  });
});
