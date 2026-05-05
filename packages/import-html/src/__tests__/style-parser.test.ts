import { describe, expect, it } from "vitest";
import {
  parseAlignment,
  parseBorderShorthand,
  parseColor,
  parseFontFamily,
  parseFontWeight,
  parsePaddingShorthand,
  parsePxValue,
  parseStyleAttribute,
  parseWidthPercent,
  readPaddingFromStyles,
  serializeStyleAttribute,
} from "../style-parser";

describe("parseStyleAttribute", () => {
  it("parses semicolon-separated declarations into a record", () => {
    const r = parseStyleAttribute("color: red; font-size: 14px");
    expect(r).toEqual({ color: "red", "font-size": "14px" });
  });

  it("lowercases keys and trims values", () => {
    const r = parseStyleAttribute("  COLOR :  #FFF  ");
    expect(r).toEqual({ color: "#FFF" });
  });

  it("returns empty record for undefined or empty input", () => {
    expect(parseStyleAttribute(undefined)).toEqual({});
    expect(parseStyleAttribute("")).toEqual({});
    expect(parseStyleAttribute("   ")).toEqual({});
  });

  it("ignores malformed declarations without a colon", () => {
    const r = parseStyleAttribute("color: red; broken; font: 1px");
    expect(r).toEqual({ color: "red", font: "1px" });
  });

  it("preserves the last value when a key is repeated", () => {
    const r = parseStyleAttribute("color: red; color: blue");
    expect(r).toEqual({ color: "blue" });
  });
});

describe("serializeStyleAttribute", () => {
  it("serializes a record back to a CSS string", () => {
    expect(serializeStyleAttribute({ color: "red", "font-size": "14px" })).toBe(
      "color: red; font-size: 14px",
    );
  });

  it("returns empty string for empty record", () => {
    expect(serializeStyleAttribute({})).toBe("");
  });
});

describe("parsePxValue", () => {
  it("parses px-suffixed values", () => {
    expect(parsePxValue("12px")).toBe(12);
    expect(parsePxValue("12.6px")).toBe(13);
  });

  it("parses bare numeric strings", () => {
    expect(parsePxValue("8")).toBe(8);
  });

  it("returns numbers as-is (rounded)", () => {
    expect(parsePxValue(7.4)).toBe(7);
    expect(parsePxValue(7.5)).toBe(8);
  });

  it("returns 0 for missing or invalid input", () => {
    expect(parsePxValue(undefined)).toBe(0);
    expect(parsePxValue("")).toBe(0);
    expect(parsePxValue("auto")).toBe(0);
    expect(parsePxValue("2em")).toBe(0);
  });
});

describe("parseWidthPercent", () => {
  it("returns numeric percent", () => {
    expect(parseWidthPercent("75%")).toBe(75);
    expect(parseWidthPercent("33.3%")).toBe(33);
  });

  it("returns 100 for missing or non-percent", () => {
    expect(parseWidthPercent(undefined)).toBe(100);
    expect(parseWidthPercent("100px")).toBe(100);
  });
});

describe("parseColor", () => {
  it("normalizes 6-digit hex to lowercase", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });

  it("converts rgb() to hex", () => {
    expect(parseColor("rgb(255, 128, 0)")).toBe("#ff8000");
  });

  it("converts rgba() to hex (drops alpha)", () => {
    expect(parseColor("rgba(255, 128, 0, 0.5)")).toBe("#ff8000");
  });

  it("resolves named colors", () => {
    expect(parseColor("red")).toBe("#ff0000");
    expect(parseColor("BLACK")).toBe("#000000");
  });

  it("returns empty for transparent / inherit / none / unknown", () => {
    expect(parseColor("transparent")).toBe("");
    expect(parseColor("inherit")).toBe("");
    expect(parseColor("none")).toBe("");
    expect(parseColor("notacolor")).toBe("");
    expect(parseColor(undefined)).toBe("");
  });
});

describe("parsePaddingShorthand", () => {
  it("expands 1-value shorthand", () => {
    expect(parsePaddingShorthand("10px")).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("expands 2-value shorthand (vertical / horizontal)", () => {
    expect(parsePaddingShorthand("10px 20px")).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });

  it("expands 3-value shorthand", () => {
    expect(parsePaddingShorthand("10px 20px 30px")).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 20,
    });
  });

  it("expands 4-value shorthand", () => {
    expect(parsePaddingShorthand("1px 2px 3px 4px")).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it("returns zeroes for missing input", () => {
    expect(parsePaddingShorthand(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("readPaddingFromStyles", () => {
  it("prefers longhand over shorthand", () => {
    const r = readPaddingFromStyles({
      padding: "5px",
      "padding-top": "12px",
      "padding-left": "8px",
    });
    expect(r).toEqual({ top: 12, right: 5, bottom: 5, left: 8 });
  });

  it("falls back to shorthand when no longhand", () => {
    expect(readPaddingFromStyles({ padding: "10px" })).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });
});

describe("parseFontFamily", () => {
  it("returns first font in stack and strips quotes", () => {
    expect(parseFontFamily('"Helvetica Neue", Arial, sans-serif')).toBe(
      "Helvetica Neue",
    );
    expect(parseFontFamily("'Open Sans', sans-serif")).toBe("Open Sans");
  });

  it("returns empty for missing input", () => {
    expect(parseFontFamily(undefined)).toBe("");
    expect(parseFontFamily("")).toBe("");
  });
});

describe("parseFontWeight", () => {
  it("returns empty for default weights", () => {
    expect(parseFontWeight("normal")).toBe("");
    expect(parseFontWeight("400")).toBe("");
    expect(parseFontWeight(undefined)).toBe("");
  });

  it("returns weight for non-default values", () => {
    expect(parseFontWeight("bold")).toBe("bold");
    expect(parseFontWeight("700")).toBe("700");
  });
});

describe("parseAlignment", () => {
  it("returns recognized alignments", () => {
    expect(parseAlignment("center")).toBe("center");
    expect(parseAlignment("RIGHT")).toBe("right");
  });

  it("falls back when unrecognized", () => {
    expect(parseAlignment("justify")).toBe("left");
    expect(parseAlignment(undefined, "center")).toBe("center");
  });
});

describe("parseBorderShorthand", () => {
  it("parses 1px solid #ccc", () => {
    expect(parseBorderShorthand("1px solid #cccccc")).toEqual({
      width: 1,
      style: "solid",
      color: "#cccccc",
    });
  });

  it("is order-tolerant", () => {
    expect(parseBorderShorthand("dashed red 2px")).toEqual({
      width: 2,
      style: "dashed",
      color: "#ff0000",
    });
  });

  it("returns defaults for empty input", () => {
    expect(parseBorderShorthand(undefined)).toEqual({
      width: 0,
      style: "solid",
      color: "#000000",
    });
  });

  it("ignores unrecognized tokens", () => {
    expect(parseBorderShorthand("1px solid notacolor")).toEqual({
      width: 1,
      style: "solid",
      color: "#000000",
    });
  });
});
