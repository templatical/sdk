import { describe, expect, it } from "vitest";
import { colorFromPaint, parseColor, parsePxValue } from "../css";

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
});

describe("parsePxValue", () => {
  it("reads a px length", () => {
    expect(parsePxValue("30px")).toBe(30);
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
