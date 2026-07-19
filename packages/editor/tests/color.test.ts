import { describe, expect, it } from "vitest";
import { normalizeColorToHex } from "../src/utils/color";

describe("normalizeColorToHex", () => {
  it("converts browser-serialized rgb() to #rrggbb", () => {
    expect(normalizeColorToHex("rgb(255, 102, 0)")).toBe("#ff6600");
    expect(normalizeColorToHex("rgb(0, 0, 0)")).toBe("#000000");
    expect(normalizeColorToHex("rgba(255, 141, 216, 1)")).toBe("#ff8dd8");
    // The reported case: an applied text color reads back as rgb.
    expect(normalizeColorToHex("rgb(19, 100, 214)")).toBe("#1364d6");
  });

  it("leaves hex and keyword colors unchanged", () => {
    expect(normalizeColorToHex("#ff6600")).toBe("#ff6600");
    expect(normalizeColorToHex("red")).toBe("red");
    expect(normalizeColorToHex("")).toBe("");
  });
});
