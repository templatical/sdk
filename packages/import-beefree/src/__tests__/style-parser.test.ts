import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
  parseWidthPercent,
  parseFontFamily,
} from "../style-parser";

describe("parsePxValue", () => {
  it("extracts integer from px string", () => {
    expect(parsePxValue("16px")).toBe(16);
    expect(parsePxValue("0px")).toBe(0);
    expect(parsePxValue("254px")).toBe(254);
  });

  it("handles decimal values", () => {
    expect(parsePxValue("16.5px")).toBe(17);
  });

  it("returns 0 for undefined or empty", () => {
    expect(parsePxValue(undefined)).toBe(0);
    expect(parsePxValue("")).toBe(0);
  });

  it("returns 0 for non-px values", () => {
    expect(parsePxValue("auto")).toBe(0);
    expect(parsePxValue("100%")).toBe(0);
  });
});

describe("parseColor", () => {
  it("returns 6-digit hex lowercase", () => {
    expect(parseColor("#FFFFFF")).toBe("#ffffff");
    expect(parseColor("#cccccc")).toBe("#cccccc");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#fff")).toBe("#ffffff");
    expect(parseColor("#abc")).toBe("#aabbcc");
  });

  it("returns empty string for transparent", () => {
    expect(parseColor("transparent")).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(parseColor(undefined)).toBe("");
  });

  it("passes through rgb values", () => {
    expect(parseColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
  });
});

describe("parseBorderTop", () => {
  it("parses border shorthand", () => {
    const result = parseBorderTop("2px solid #cccccc");
    expect(result.width).toBe(2);
    expect(result.style).toBe("solid");
    expect(result.color).toBe("#cccccc");
  });

  it("handles dashed borders", () => {
    const result = parseBorderTop("1px dashed #000000");
    expect(result.width).toBe(1);
    expect(result.style).toBe("dashed");
  });

  it("returns defaults for undefined", () => {
    const result = parseBorderTop(undefined);
    expect(result.width).toBe(0);
    expect(result.style).toBe("solid");
  });
});

describe("extractPadding", () => {
  it("extracts individual padding values", () => {
    const result = extractPadding({
      "padding-top": "10px",
      "padding-right": "20px",
      "padding-bottom": "15px",
      "padding-left": "5px",
    });
    expect(result).toEqual({ top: 10, right: 20, bottom: 15, left: 5 });
  });

  it("handles shorthand padding with 1 value", () => {
    const result = extractPadding({ padding: "10px" });
    expect(result).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it("handles shorthand padding with 2 values", () => {
    const result = extractPadding({ padding: "10px 20px" });
    expect(result).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });
  });

  it("handles shorthand padding with 3 values", () => {
    const result = extractPadding({ padding: "10px 20px 30px" });
    expect(result).toEqual({ top: 10, right: 20, bottom: 30, left: 20 });
  });

  it("handles shorthand padding with 4 values", () => {
    const result = extractPadding({ padding: "10px 20px 30px 40px" });
    expect(result).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
  });

  it("returns zeros for undefined", () => {
    const result = extractPadding(undefined);
    expect(result).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("parseWidthPercent", () => {
  it("extracts percentage value", () => {
    expect(parseWidthPercent("80%")).toBe(80);
    expect(parseWidthPercent("100%")).toBe(100);
  });

  it("returns 100 for undefined", () => {
    expect(parseWidthPercent(undefined)).toBe(100);
  });

  it("returns 100 for px values", () => {
    expect(parseWidthPercent("600px")).toBe(100);
  });
});

describe("parseFontFamily", () => {
  it("extracts first font from stack", () => {
    expect(
      parseFontFamily("Montserrat, Trebuchet MS, Lucida Grande, sans-serif"),
    ).toBe("Montserrat");
  });

  it("strips quotes", () => {
    expect(parseFontFamily("'Open Sans', sans-serif")).toBe("Open Sans");
  });

  it("returns empty for undefined", () => {
    expect(parseFontFamily(undefined)).toBe("");
  });
});
