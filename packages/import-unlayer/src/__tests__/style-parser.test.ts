import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parseColor,
  parsePaddingShorthand,
  parseBorderObject,
  parseWidthPercent,
  parseFontFamily,
} from "../style-parser";

describe("parsePxValue", () => {
  it("parses '12px' to 12", () => {
    expect(parsePxValue("12px")).toBe(12);
  });
  it("parses bare numbers", () => {
    expect(parsePxValue(20)).toBe(20);
  });
  it("returns 0 on undefined", () => {
    expect(parsePxValue(undefined)).toBe(0);
  });
  it("parses bare numeric strings without unit", () => {
    expect(parsePxValue("16")).toBe(16);
  });
  it("parses numeric strings with trailing whitespace", () => {
    expect(parsePxValue("16  ")).toBe(16);
  });
  it("rejects non-px units", () => {
    expect(parsePxValue("16em")).toBe(0);
    expect(parsePxValue("16rem")).toBe(0);
  });
});

describe("parseColor", () => {
  it("normalizes 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });
  it("lowercases 6-digit hex", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });
  it("returns empty for transparent", () => {
    expect(parseColor("transparent")).toBe("");
  });
  it("passes through rgb()", () => {
    expect(parseColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });
});

describe("parsePaddingShorthand", () => {
  it("expands single value", () => {
    expect(parsePaddingShorthand("10px")).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });
  it("expands two-value shorthand", () => {
    expect(parsePaddingShorthand("10px 20px")).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });
  it("expands three-value shorthand", () => {
    expect(parsePaddingShorthand("10px 20px 30px")).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 20,
    });
  });
  it("expands four-value shorthand", () => {
    expect(parsePaddingShorthand("1px 2px 3px 4px")).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });
  it("returns zeros on undefined", () => {
    expect(parsePaddingShorthand(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("parseBorderObject", () => {
  it("extracts width/style/color", () => {
    expect(
      parseBorderObject({
        borderTopWidth: "3px",
        borderTopStyle: "dotted",
        borderTopColor: "#ff0000",
      }),
    ).toEqual({ width: 3, style: "dotted", color: "#ff0000" });
  });
  it("returns defaults on undefined", () => {
    expect(parseBorderObject(undefined)).toEqual({
      width: 0,
      style: "solid",
      color: "#000000",
    });
  });
});

describe("parseWidthPercent", () => {
  it("extracts integer percent", () => {
    expect(parseWidthPercent("75%")).toBe(75);
  });
  it("returns 100 default", () => {
    expect(parseWidthPercent(undefined)).toBe(100);
  });
});

describe("parseFontFamily", () => {
  it("reads .value from object form", () => {
    expect(parseFontFamily({ label: "Sans", value: "Helvetica, Arial" })).toBe(
      "Helvetica",
    );
  });
  it("reads first family from string", () => {
    expect(parseFontFamily("'Open Sans', sans-serif")).toBe("Open Sans");
  });
  it("returns empty for undefined", () => {
    expect(parseFontFamily(undefined)).toBe("");
  });
});
