import { describe, expect, it } from "vitest";
import {
  canonicalizeHexColor,
  normalizeColorToHex,
  opaqueHex,
} from "../src/utils/color";

describe("normalizeColorToHex", () => {
  it("converts browser-serialized rgb() to #rrggbb", () => {
    expect(normalizeColorToHex("rgb(255, 102, 0)")).toBe("#ff6600");
    expect(normalizeColorToHex("rgb(0, 0, 0)")).toBe("#000000");
    expect(normalizeColorToHex("rgba(255, 141, 216, 1)")).toBe("#ff8dd8");
    expect(normalizeColorToHex("rgba(255, 141, 216, 1.0)")).toBe("#ff8dd8");
    expect(normalizeColorToHex("rgba(0, 0, 0, 0.5)")).toBe(
      "rgba(0, 0, 0, 0.5)",
    );
    expect(normalizeColorToHex("rgba(0, 0, 0, 0)")).toBe("rgba(0, 0, 0, 0)");
    expect(normalizeColorToHex("transparent")).toBe("transparent");
    // The reported case: an applied text color reads back as rgb.
    expect(normalizeColorToHex("rgb(19, 100, 214)")).toBe("#1364d6");
  });

  it("opaqueHex keeps the RGB channels of a partial-alpha color", () => {
    expect(opaqueHex("rgba(255, 0, 0, 0.5)")).toBe("#ff0000");
    expect(opaqueHex("#abc")).toBe("#aabbcc");
    expect(opaqueHex("transparent")).toBeNull();
    expect(opaqueHex("")).toBeNull();
  });

  it("leaves hex and keyword colors unchanged", () => {
    expect(normalizeColorToHex("#ff6600")).toBe("#ff6600");
    expect(normalizeColorToHex("red")).toBe("red");
    expect(normalizeColorToHex("")).toBe("");
  });
});

describe("canonicalizeHexColor", () => {
  it("normalizes rgb() input to lowercase #rrggbb", () => {
    expect(canonicalizeHexColor("rgb(19, 100, 214)")).toBe("#1364d6");
  });

  it("expands 3-digit shorthand to 6-digit", () => {
    expect(canonicalizeHexColor("#abc")).toBe("#aabbcc");
    // Expansion is the whole point: #abc must compare equal to its round-trip.
    expect(canonicalizeHexColor("#ABC")).toBe("#aabbcc");
  });

  it("passes 6-digit hex through, lowercased", () => {
    expect(canonicalizeHexColor("#AABBCC")).toBe("#aabbcc");
    expect(canonicalizeHexColor("#1364d6")).toBe("#1364d6");
  });

  it("returns non-hex input unchanged after the rgb attempt", () => {
    expect(canonicalizeHexColor("tomato")).toBe("tomato");
    expect(canonicalizeHexColor("")).toBe("");
    // 8-digit alpha hex is not a member of the #rgb/#rrggbb domain, so it is
    // left as-is (the resolver rejects it upstream).
    expect(canonicalizeHexColor("#aabbccdd")).toBe("#aabbccdd");
  });
});
