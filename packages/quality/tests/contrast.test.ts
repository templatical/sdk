import { describe, expect, it } from "vitest";
import { getContrastRatio, isOpaqueHex, parseHex } from "../src/contrast";

describe("getContrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("returns 21 for white on black (order independent)", () => {
    expect(getContrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("returns 1 for identical colors", () => {
    expect(getContrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("computes mid-grey on white as ~4.48", () => {
    expect(getContrastRatio("#777777", "#ffffff")).toBeGreaterThan(4.4);
    expect(getContrastRatio("#777777", "#ffffff")).toBeLessThan(4.6);
  });

  it("normalizes 3-digit hex", () => {
    expect(getContrastRatio("#fff", "#000")).toBeCloseTo(21, 1);
  });

  it("returns NaN for invalid input", () => {
    expect(getContrastRatio("nope", "#fff")).toBeNaN();
    expect(getContrastRatio("#fff", "rgb(0,0,0)")).toBeNaN();
  });
});

describe("parseHex", () => {
  it("parses 6-digit with hash", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("parses 6-digit without hash", () => {
    expect(parseHex("ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("parses 3-digit", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("parses 8-digit with opaque alpha (ff)", () => {
    expect(parseHex("#ff8800ff")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("returns null for 8-digit with non-opaque alpha", () => {
    expect(parseHex("#ff880080")).toBeNull();
    expect(parseHex("#ff880000")).toBeNull();
  });

  it("returns null for invalid", () => {
    expect(parseHex("rgba(0,0,0,0.5)")).toBeNull();
    expect(parseHex("")).toBeNull();
    expect(parseHex(null)).toBeNull();
    expect(parseHex(undefined)).toBeNull();
  });
});

describe("isOpaqueHex", () => {
  it("true for valid hex", () => {
    expect(isOpaqueHex("#fff")).toBe(true);
    expect(isOpaqueHex("#abcdef")).toBe(true);
  });

  it("true for 8-digit hex with fully-opaque alpha", () => {
    expect(isOpaqueHex("#ffffffff")).toBe(true);
    expect(isOpaqueHex("#000000ff")).toBe(true);
  });

  it("false for 8-digit hex with non-opaque alpha", () => {
    expect(isOpaqueHex("#ffffff80")).toBe(false);
    expect(isOpaqueHex("#000000fe")).toBe(false);
  });

  it("false for invalid", () => {
    expect(isOpaqueHex("transparent")).toBe(false);
    expect(isOpaqueHex(undefined)).toBe(false);
  });
});
