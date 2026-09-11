import { describe, expect, it } from "vitest";
import {
  parseColor,
  parsePercent,
  parsePx,
  readPadding,
} from "../attribute-parser";

describe("parsePx", () => {
  it("parses 10px", () => {
    expect(parsePx("10px")).toBe(10);
  });
  it("parses a number", () => {
    expect(parsePx(12)).toBe(12);
  });
  it("returns undefined for unset", () => {
    expect(parsePx("")).toBe(undefined);
  });
});

describe("parsePercent", () => {
  it("parses 50%", () => {
    expect(parsePercent("50%")).toBe(50);
  });
  it("parses 33.33%", () => {
    expect(parsePercent("33.33%")).toBe(33.33);
  });
  it("returns null for missing", () => {
    expect(parsePercent(undefined)).toBe(null);
  });
  it("returns null for empty", () => {
    expect(parsePercent("")).toBe(null);
  });
});

describe("parseColor", () => {
  it("keeps a hex colour", () => {
    expect(parseColor("#8C9A80")).toBe("#8C9A80");
  });
  it("returns undefined for unset", () => {
    expect(parseColor("transparent")).toBe(undefined);
  });
});

describe("readPadding", () => {
  it("reads the four sides", () => {
    const attrs: Record<string, string> = {
      "padding-top": "25px",
      "padding-bottom": "25px",
      "padding-left": "0px",
      "padding-right": "0px",
    };
    expect(readPadding((k) => attrs[k])).toEqual({
      top: 25,
      right: 0,
      bottom: 25,
      left: 0,
    });
  });
  it("defaults a missing side to 0", () => {
    expect(readPadding(() => undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});
