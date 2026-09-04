import { describe, expect, it } from "vitest";
import {
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
  parsePercent,
  parsePxValue,
} from "../attribute-parser";

describe("parsePxValue", () => {
  it("reads a px length", () => {
    expect(parsePxValue("24px")).toBe(24);
  });

  it("reads a bare number as px", () => {
    expect(parsePxValue("24")).toBe(24);
  });

  it("accepts a numeric input", () => {
    expect(parsePxValue(24.6)).toBe(25);
  });

  it("rounds a fractional px length", () => {
    expect(parsePxValue("33.4px")).toBe(33);
  });

  it("returns 0 for a missing value", () => {
    expect(parsePxValue(undefined)).toBe(0);
  });

  it("returns 0 for a unit it cannot express", () => {
    expect(parsePxValue("2em")).toBe(0);
  });
});

describe("parseColor", () => {
  it("passes through 6-digit hex, lowercased", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });

  it("converts rgb() to hex", () => {
    expect(parseColor("rgb(255, 0, 128)")).toBe("#ff0080");
  });

  it("drops the alpha channel of rgba()", () => {
    expect(parseColor("rgba(255, 0, 128, 0.5)")).toBe("#ff0080");
  });

  it("maps a named colour", () => {
    expect(parseColor("white")).toBe("#ffffff");
  });

  it("returns an empty string for transparent", () => {
    expect(parseColor("transparent")).toBe("");
  });

  it("returns an empty string for an unknown value", () => {
    expect(parseColor("hsl(200 50% 50%)")).toBe("");
  });

  it("returns an empty string for a missing value", () => {
    expect(parseColor(undefined)).toBe("");
  });
});

describe("parsePaddingShorthand", () => {
  it("expands one value to all four sides", () => {
    expect(parsePaddingShorthand("10px")).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("expands two values to vertical/horizontal", () => {
    expect(parsePaddingShorthand("10px 20px")).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });

  it("expands three values, mirroring the horizontal", () => {
    expect(parsePaddingShorthand("10px 20px 30px")).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 20,
    });
  });

  it("reads four values clockwise", () => {
    expect(parsePaddingShorthand("1px 2px 3px 4px")).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it("returns zeroes for a missing value", () => {
    expect(parsePaddingShorthand(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("parseFontFamily", () => {
  it("returns the first family in a stack, unquoted", () => {
    expect(parseFontFamily("'Helvetica Neue', Helvetica, sans-serif")).toBe(
      "Helvetica Neue",
    );
  });

  it("returns an empty string for a missing value", () => {
    expect(parseFontFamily(undefined)).toBe("");
  });
});

describe("parseAlignment", () => {
  it("passes through a supported alignment", () => {
    expect(parseAlignment("right")).toBe("right");
  });

  it("falls back for an unsupported alignment", () => {
    expect(parseAlignment("justify")).toBe("left");
  });

  it("honours an explicit fallback", () => {
    expect(parseAlignment(undefined, "center")).toBe("center");
  });
});

describe("parsePercent", () => {
  it("reads a percentage", () => {
    expect(parsePercent("33.33%")).toBe(33.33);
  });

  it("returns null for a px length", () => {
    expect(parsePercent("200px")).toBe(null);
  });

  it("returns null for a missing value", () => {
    expect(parsePercent(undefined)).toBe(null);
  });
});

describe("parseBorderStyle", () => {
  it("passes through a style the block model supports", () => {
    expect(parseBorderStyle("dashed")).toBe("dashed");
  });

  it("falls back to solid for a style it does not", () => {
    expect(parseBorderStyle("groove")).toBe("solid");
  });

  it("falls back to solid for a missing value", () => {
    expect(parseBorderStyle(undefined)).toBe("solid");
  });
});
