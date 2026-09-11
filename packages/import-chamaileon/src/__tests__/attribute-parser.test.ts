import { describe, expect, it } from "vitest";
import {
  parseAlignment,
  parseBorderShorthand,
  parseColor,
  parseLineStyle,
  parsePadding,
  parsePx,
} from "../attribute-parser";

describe("parsePx", () => {
  it("parses a px length", () => {
    expect(parsePx("24px")).toBe(24);
  });
  it("parses a number", () => {
    expect(parsePx(24)).toBe(24);
  });
  it("rounds a float px string", () => {
    expect(parsePx("359.9999999999994px")).toBe(360);
    expect(parsePx("66.66666666666666px")).toBe(67);
  });
  it("returns undefined for unset", () => {
    expect(parsePx(null)).toBeUndefined();
    expect(parsePx("")).toBeUndefined();
  });
  it("returns undefined for a unit it cannot express", () => {
    expect(parsePx("2em")).toBeUndefined();
  });
});

describe("parseColor", () => {
  it("lowercases 6-digit hex", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });
  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });
  it("returns undefined for unset", () => {
    expect(parseColor(null)).toBeUndefined();
  });
  it("returns undefined for transparent", () => {
    expect(parseColor("transparent")).toBeUndefined();
  });
});

describe("parsePadding", () => {
  it("reads split camelCase keys", () => {
    expect(
      parsePadding({
        paddingTop: "10px",
        paddingRight: "8px",
        paddingBottom: "6px",
        paddingLeft: "4px",
      }),
    ).toEqual({ top: 10, right: 8, bottom: 6, left: 4 });
  });
  it("reads kebab-case keys after the caller has camelCased them", () => {
    expect(parsePadding({ paddingTop: "5px" })).toEqual({
      top: 5,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("parseLineStyle / parseBorderShorthand", () => {
  it("parses a 2.0 divider lineStyle", () => {
    expect(parseLineStyle("2px solid #00a591")).toEqual({
      thickness: 2,
      lineStyle: "solid",
      color: "#00a591",
    });
  });
  it("parses an outlined-button border", () => {
    expect(parseBorderShorthand("1px solid #00a591")).toEqual({
      width: 1,
      style: "solid",
      color: "#00a591",
    });
  });
  it("returns undefined for a zero-width border", () => {
    expect(parseBorderShorthand("0px solid #000000")).toBeUndefined();
  });
});

describe("parseAlignment", () => {
  it("accepts left/center/right", () => {
    expect(parseAlignment("center", "left")).toBe("center");
  });
  it("falls back for unknown", () => {
    expect(parseAlignment("justify", "left")).toBe("left");
  });
});
