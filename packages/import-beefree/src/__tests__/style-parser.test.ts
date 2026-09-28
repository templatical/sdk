import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
  parseDividerWidth,
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

  // A CSS-wide keyword names no color, so it has to read as unset: returned
  // as is, it lands in a block field and the renderer writes it out verbatim.
  it.each(["inherit", "initial", "unset", "revert"])(
    "returns empty string for the CSS-wide keyword %s",
    (keyword) => {
      expect(parseColor(keyword)).toBe("");
    },
  );

  it("matches keywords case-insensitively and ignores surrounding space", () => {
    expect(parseColor(" INHERIT ")).toBe("");
    expect(parseColor("Transparent")).toBe("");
  });

  it("returns empty string for none, like the other importers", () => {
    expect(parseColor("none")).toBe("");
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

describe("parseDividerWidth", () => {
  it("reads a percentage", () => {
    expect(parseDividerWidth("80%")).toEqual({ value: 80, unit: "%" });
    expect(parseDividerWidth("37.5 %")).toEqual({ value: 37.5, unit: "%" });
    expect(parseDividerWidth("-10%")).toEqual({ value: -10, unit: "%" });
  });

  it("reads a px width as its number of pixels", () => {
    expect(parseDividerWidth("600px")).toEqual({ value: 600, unit: "px" });
    expect(parseDividerWidth(" 16.5px ")).toEqual({ value: 16.5, unit: "px" });
  });

  it("returns undefined for anything that is neither px nor %", () => {
    expect(parseDividerWidth("auto")).toBeUndefined();
    expect(parseDividerWidth("inherit")).toBeUndefined();
    expect(parseDividerWidth("50em")).toBeUndefined();
    expect(parseDividerWidth("")).toBeUndefined();
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

  // A CSS-wide keyword names no font. Returned as is it would become a
  // block's own font, and the sent email would fall back to the client's
  // default face instead of the template's font.
  it.each(["inherit", "initial", "unset", "revert", "Inherit"])(
    "returns empty for the CSS-wide keyword %s",
    (keyword) => {
      expect(parseFontFamily(keyword)).toBe("");
    },
  );
});
