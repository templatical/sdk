import { describe, expect, it } from "vitest";
import {
  colorFromPaint,
  parseColor,
  parsePaddingShorthand,
  parsePxValue,
} from "../css";

describe("parseColor", () => {
  it("normalizes 6-digit hex", () => {
    expect(parseColor("#E5FBF6")).toBe("#e5fbf6");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#113")).toBe("#111133");
  });

  it("accepts a bare bgcolor hex", () => {
    expect(parseColor("113F37")).toBe("#113f37");
  });

  it("treats transparent as unset", () => {
    expect(parseColor("transparent")).toBe("");
  });

  it("reads an rgb() fill as hex", () => {
    expect(parseColor("rgb(229, 251, 246)")).toBe("#e5fbf6");
  });

  it("drops the alpha from rgba()", () => {
    expect(parseColor("rgba(229, 251, 246, 0.5)")).toBe("#e5fbf6");
  });
});

describe("parsePxValue", () => {
  it("reads a px length", () => {
    expect(parsePxValue("30px")).toBe(30);
  });
});

describe("parsePaddingShorthand", () => {
  it("maps three values to top, horizontal, and bottom padding", () => {
    expect(parsePaddingShorthand("8px 12px 16px")).toEqual({
      top: 8,
      right: 12,
      bottom: 16,
      left: 12,
    });
  });
});

describe("colorFromPaint", () => {
  it("lets inline background-color win over bgcolor", () => {
    expect(colorFromPaint("background-color:#E5FBF6", "#ffffff")).toBe(
      "#e5fbf6",
    );
  });

  it("reads a background shorthand color", () => {
    expect(colorFromPaint("background:#113F37")).toBe("#113f37");
  });

  it("skips a transparent stripe fill", () => {
    expect(colorFromPaint("background-color:transparent", "#ffffff")).toBe(
      "#ffffff",
    );
  });
});
