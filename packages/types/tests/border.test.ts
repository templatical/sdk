import { describe, expect, it } from "vitest";
import {
  toBorderCss,
  toBorderDeclarations,
  toBorderRadiusCss,
  uniformBorder,
} from "../src";
import type { BorderSideValue, BorderValue } from "../src";

const SIDE: BorderSideValue = { width: 1, style: "solid", color: "#000000" };
const NONE: BorderSideValue = { ...SIDE, width: 0 };

describe("toBorderCss", () => {
  it("formats one side as a CSS border value", () => {
    expect(toBorderCss({ width: 2, style: "dashed", color: "#cccccc" })).toBe(
      "2px dashed #cccccc",
    );
  });

  it("returns null when the side is absent", () => {
    expect(toBorderCss(undefined)).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns null for a width of %s",
    (width) => {
      expect(toBorderCss({ ...SIDE, width })).toBeNull();
    },
  );
});

describe("toBorderDeclarations", () => {
  it("uses the shorthand when all four sides match", () => {
    expect(toBorderDeclarations(uniformBorder(SIDE))).toEqual({
      border: "1px solid #000000",
    });
  });

  it("emits one declaration per drawn side", () => {
    const border: BorderValue = {
      top: NONE,
      right: SIDE,
      bottom: NONE,
      left: { width: 3, style: "dotted", color: "#ff0000" },
    };
    expect(toBorderDeclarations(border)).toEqual({
      "border-right": "1px solid #000000",
      "border-left": "3px dotted #ff0000",
    });
  });

  it("is empty with no border or no drawn side", () => {
    expect(toBorderDeclarations(undefined)).toEqual({});
    expect(toBorderDeclarations(uniformBorder(NONE))).toEqual({});
  });
});

describe("toBorderRadiusCss", () => {
  it("formats a single number", () => {
    expect(toBorderRadiusCss(8)).toBe("8px");
  });

  it("collapses matching corners to a single value", () => {
    expect(
      toBorderRadiusCss({
        topLeft: 4,
        topRight: 4,
        bottomRight: 4,
        bottomLeft: 4,
      }),
    ).toBe("4px");
  });

  it("orders differing corners as top-left, top-right, bottom-right, bottom-left", () => {
    expect(
      toBorderRadiusCss({
        topLeft: 1,
        topRight: 2,
        bottomRight: 3,
        bottomLeft: 4,
      }),
    ).toBe("1px 2px 3px 4px");
  });

  it("treats a negative or non-finite corner as square", () => {
    expect(
      toBorderRadiusCss({
        topLeft: 8,
        topRight: -2,
        bottomRight: Number.NaN,
        bottomLeft: 8,
      }),
    ).toBe("8px 0px 0px 8px");
  });

  it("returns null when every corner is square", () => {
    expect(toBorderRadiusCss(undefined)).toBeNull();
    expect(toBorderRadiusCss(0)).toBeNull();
    expect(toBorderRadiusCss(-5)).toBeNull();
    expect(
      toBorderRadiusCss({
        topLeft: 0,
        topRight: 0,
        bottomRight: 0,
        bottomLeft: 0,
      }),
    ).toBeNull();
  });
});
