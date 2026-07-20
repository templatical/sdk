import { describe, expect, it } from "vitest";
import { resolveHtmlBlockPreview } from "../src/utils/resolveHtmlBlockPreview";

describe("resolveHtmlBlockPreview", () => {
  it("returns false when undefined (feature is off by default)", () => {
    expect(resolveHtmlBlockPreview(undefined)).toBe(false);
  });

  it("returns false for the boolean false", () => {
    expect(resolveHtmlBlockPreview(false)).toBe(false);
  });

  it("returns true for the boolean shorthand true", () => {
    expect(resolveHtmlBlockPreview(true)).toBe(true);
  });

  it("returns true for { enabled: true }", () => {
    expect(resolveHtmlBlockPreview({ enabled: true })).toBe(true);
  });

  it("returns false for { enabled: false }", () => {
    expect(resolveHtmlBlockPreview({ enabled: false })).toBe(false);
  });
});
