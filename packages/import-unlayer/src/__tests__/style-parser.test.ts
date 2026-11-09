import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parseColor,
  parsePaddingShorthand,
  parseBorderObject,
  isTransparentColor,
  parseDividerWidth,
  parseFontFamily,
  readUnlayerBackgroundImage,
} from "../style-parser";
import type { UnlayerBackgroundImage } from "../types";
import { expectLinear } from "./expectLinear";

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

  it("parses '12 px' with whitespace between number and unit", () => {
    expect(parsePxValue("12 px")).toBe(12);
  });

  it("parses '12px ' with trailing whitespace after unit", () => {
    expect(parsePxValue("12px ")).toBe(12);
  });

  // Regression: the old `\s*(?:px)?\s*` suffix had two `\s*` quantifiers
  // around an optional group — classic polynomial-ReDoS on inputs like
  // `9                          ` (a digit followed by many spaces). The
  // rewrite collapses to a single `\s*(?:px\s*)?` so trailing whitespace
  // is matched by one quantifier with no backtracking.
  it("rejects digit-then-long-whitespace input in linear time (ReDoS regression)", () => {
    // `x` makes it fail the `px?` group
    expect(parsePxValue("9" + " ".repeat(50_000) + "x")).toBe(0);
    expectLinear((n) => {
      const value = "9" + " ".repeat(n) + "x";
      return () => parsePxValue(value);
    }, 2_000);
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

  // CSS drops a padding with a negative length, judged before rounding:
  // -0.4px rounds to -0. A literal -0 is 0.
  it("reads a shorthand with a negative side as no padding", () => {
    for (const value of ["-10px 0px", "10px -0.4px", "5px 5px 5px -1px"]) {
      expect(parsePaddingShorthand(value)).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    }
    expect(parsePaddingShorthand("10px -0px").top).toBe(10);
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
    ).toEqual({ width: 3, style: "dotted", color: "#ff0000", drawn: true });
  });
  it("returns defaults on undefined", () => {
    expect(parseBorderObject(undefined)).toEqual({
      width: 0,
      style: "solid",
      color: "#000000",
      drawn: true,
    });
  });
  it("is not drawn at a stated 0 width, with no style, or in a transparent colour", () => {
    for (const border of [
      {
        borderTopWidth: "0px",
        borderTopStyle: "solid",
        borderTopColor: "#ccc",
      },
      { borderTopWidth: "1px", borderTopStyle: "none", borderTopColor: "#ccc" },
      {
        borderTopWidth: "1px",
        borderTopStyle: "hidden",
        borderTopColor: "#ccc",
      },
      {
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "transparent",
      },
      {
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "rgba(0,0,0,0)",
      },
    ]) {
      expect([border, parseBorderObject(border).drawn]).toEqual([
        border,
        false,
      ]);
    }
  });
  // A zero-width pattern that can split a run of zeros or of spaces two ways
  // backtracks quadratically on a long run that fails to match (CodeQL
  // js/polynomial-redos).
  it("reads long runs of zeros and spaces in linear time (ReDoS regression)", () => {
    const border = (borderTopWidth: string) =>
      parseBorderObject({
        borderTopWidth,
        borderTopStyle: "solid",
        borderTopColor: "#cccccc",
      });
    for (const width of [
      (n: number) => `${"0".repeat(n)}x`,
      (n: number) => `0${" ".repeat(n)}x`,
    ]) {
      expect(border(width(40_000)).drawn).toBe(true);
      expectLinear((n) => {
        const value = width(n);
        return () => border(value);
      }, 2_000);
    }
  });

  it("reads a zero width in every CSS length unit", () => {
    for (const borderTopWidth of ["0svh", "0lh", "0cqw", "0dvmax", "0Q"]) {
      expect([
        borderTopWidth,
        parseBorderObject({
          borderTopWidth,
          borderTopStyle: "solid",
          borderTopColor: "#ccc",
        }).drawn,
      ]).toEqual([borderTopWidth, false]);
    }
  });

  it("reads a zero width in any unit and a style in any case", () => {
    for (const border of [
      {
        borderTopWidth: "0pt",
        borderTopStyle: "solid",
        borderTopColor: "#ccc",
      },
      {
        borderTopWidth: "0em",
        borderTopStyle: "solid",
        borderTopColor: "#ccc",
      },
      {
        borderTopWidth: "+0px",
        borderTopStyle: "solid",
        borderTopColor: "#ccc",
      },
      { borderTopWidth: "1px", borderTopStyle: "NONE", borderTopColor: "#ccc" },
      {
        borderTopWidth: "1px",
        borderTopStyle: " Hidden ",
        borderTopColor: "#ccc",
      },
    ]) {
      expect([border, parseBorderObject(border).drawn]).toEqual([
        border,
        false,
      ]);
    }
    expect(
      parseBorderObject({
        borderTopWidth: "2px",
        borderTopStyle: "DASHED",
        borderTopColor: "#ccc",
      }),
    ).toEqual({ width: 2, style: "dashed", color: "#cccccc", drawn: true });
  });

  it("is drawn with an unreadable width", () => {
    expect(
      parseBorderObject({
        borderTopWidth: "thin",
        borderTopStyle: "solid",
        borderTopColor: "#ccc",
      }).drawn,
    ).toBe(true);
  });
  it("takes no room with a none or hidden style", () => {
    expect(
      parseBorderObject({
        borderTopWidth: "3px",
        borderTopStyle: "hidden",
        borderTopColor: "#ccc",
      }).width,
    ).toBe(0);
  });
});

describe("isTransparentColor", () => {
  it("is true for a colour with no opacity", () => {
    for (const value of [
      "transparent",
      "TRANSPARENT",
      "#0000",
      "#ffffff00",
      "rgba(0, 0, 0, 0)",
      "rgb(0 0 0 / 0%)",
      "hsla(0, 0%, 100%, 0)",
    ]) {
      expect([value, isTransparentColor(value)]).toEqual([value, true]);
    }
  });

  it("is false for a colour that paints", () => {
    for (const value of [
      undefined,
      "",
      "#000",
      "#ffffff80",
      "rgba(0, 0, 0, 0.5)",
      "rgb(0 0 0 / 1%)",
      "red",
    ]) {
      expect([value, isTransparentColor(value)]).toEqual([value, false]);
    }
  });
});

describe("parseDividerWidth", () => {
  it("reads a percentage, fractional or spaced", () => {
    expect(parseDividerWidth("75%")).toEqual({ unit: "%", value: 75 });
    expect(parseDividerWidth(" 33.5 % ")).toEqual({ unit: "%", value: 33.5 });
  });

  it("reads px, a unitless string and a number as px", () => {
    expect(parseDividerWidth("300px")).toEqual({ unit: "px", value: 300 });
    expect(parseDividerWidth("300")).toEqual({ unit: "px", value: 300 });
    expect(parseDividerWidth(300)).toEqual({ unit: "px", value: 300 });
  });

  // Out-of-range values are the caller's to clamp, so the sign survives.
  it("keeps a negative value", () => {
    expect(parseDividerWidth("-10%")).toEqual({ unit: "%", value: -10 });
    expect(parseDividerWidth("-5px")).toEqual({ unit: "px", value: -5 });
  });

  it("returns undefined for any other unit or text", () => {
    expect(parseDividerWidth("auto")).toBeUndefined();
    expect(parseDividerWidth("50em")).toBeUndefined();
    expect(parseDividerWidth("")).toBeUndefined();
    expect(parseDividerWidth(Number.NaN)).toBeUndefined();
  });

  it("rejects digit-then-long-whitespace input in linear time (ReDoS guard)", () => {
    expect(parseDividerWidth("9" + " ".repeat(50_000) + "x")).toBeUndefined();
    expectLinear((n) => {
      const value = "9" + " ".repeat(n) + "x";
      return () => parseDividerWidth(value);
    }, 2_000);
  });
});

describe("parseFontFamily", () => {
  it("reads the whole stack from .value in object form", () => {
    expect(parseFontFamily({ label: "Sans", value: "Helvetica, Arial" })).toBe(
      "Helvetica, Arial",
    );
  });
  it("keeps the whole stack from a string", () => {
    expect(parseFontFamily("'Open Sans', sans-serif")).toBe(
      "'Open Sans', sans-serif",
    );
  });
  it("stores a built-in's own stack as the bare name", () => {
    expect(parseFontFamily({ value: "Arial, sans-serif" })).toBe("Arial");
  });
  it("falls back to the label when .value sets no font", () => {
    expect(parseFontFamily({ label: "Sans", value: "inherit" })).toBe("Sans");
  });
  it("returns empty for undefined", () => {
    expect(parseFontFamily(undefined)).toBe("");
  });
});

describe("readUnlayerBackgroundImage", () => {
  const read = (bg: UnlayerBackgroundImage) =>
    readUnlayerBackgroundImage(bg, "Row", 600);

  it("returns null without a url", () => {
    expect(readUnlayerBackgroundImage(undefined, "Row", 600)).toBeNull();
    expect(
      read({
        url: "",
        fullWidth: true,
        repeat: "no-repeat",
        size: "custom",
        position: "center",
      }),
    ).toBeNull();
  });

  it("reads Unlayer's defaults as the image at its own size, centred, once", () => {
    expect(
      read({
        url: "https://cdn.test/hero.jpg",
        fullWidth: true,
        repeat: "no-repeat",
        size: "custom",
        position: "center",
      }),
    ).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "center", y: "center" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("gives unset fields Unlayer's editor defaults", () => {
    expect(read({ url: "u" })?.image).toEqual({
      url: "u",
      size: "auto",
      position: { x: "center", y: "center" },
      repeat: false,
    });
  });

  it.each([
    ["top-left", { x: "left", y: "top" }],
    ["top-center", { x: "center", y: "top" }],
    ["center-right", { x: "right", y: "center" }],
    ["bottom-right", { x: "right", y: "bottom" }],
  ])("reads position %s exactly", (position, expected) => {
    const result = read({ url: "u", position });
    expect(result?.image.position).toEqual(expected);
    expect(result?.notes).toEqual([]);
  });

  it("reads a custom position's customPosition as CSS", () => {
    expect(
      read({ url: "u", position: "custom", customPosition: ["50%", "100%"] }),
    ).toEqual({
      image: {
        url: "u",
        size: "auto",
        position: { x: "center", y: "bottom" },
        repeat: false,
      },
      notes: [],
    });
    expect(
      read({ url: "u", position: "custom", customPosition: ["20px", "30%"] })
        ?.notes,
    ).toEqual([
      'Row backgroundImage.customPosition "20px 30%" has no exact Templatical equivalent; imported as "left center".',
    ]);
  });

  it("reads cover and contain exactly", () => {
    expect(read({ url: "u", size: "cover" })?.image.size).toBe("cover");
    expect(read({ url: "u", size: "contain" })?.image.size).toBe("contain");
  });

  it("reads the legacy cover and center flags when size and position are absent", () => {
    expect(read({ url: "u", cover: true, center: true })).toEqual({
      image: {
        url: "u",
        size: "cover",
        position: { x: "center", y: "top" },
        repeat: false,
      },
      notes: [],
    });
    expect(
      read({ url: "u", cover: false, center: false, repeat: false }),
    ).toEqual({
      image: {
        url: "u",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("lets the new-style size and position win over the legacy flags", () => {
    expect(
      read({
        url: "u",
        size: "contain",
        cover: true,
        position: "bottom-right",
        center: true,
      }),
    ).toEqual({
      image: {
        url: "u",
        size: "contain",
        position: { x: "right", y: "bottom" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("reads repeat, a boolean from older designs too", () => {
    expect(read({ url: "u", repeat: "repeat" })).toMatchObject({
      image: { repeat: true },
      notes: [],
    });
    expect(read({ url: "u", repeat: true })?.image.repeat).toBe(true);
    expect(read({ url: "u", repeat: false })?.image.repeat).toBe(false);
    expect(read({ url: "u", repeat: "repeat-x" })).toMatchObject({
      image: { repeat: true },
      notes: [
        'Row backgroundImage.repeat "repeat-x" has no exact Templatical equivalent; imported as "repeat".',
      ],
    });
  });
});

describe("readUnlayerBackgroundImage on adversarial input", () => {
  const run = (length: number) => {
    const digits = "0".repeat(length);
    return readUnlayerBackgroundImage(
      {
        url: "u",
        size: `${digits}!`,
        position: "custom",
        customPosition: [`${digits}!`, `${digits}!`],
      },
      "Row",
      600,
    );
  };

  it("reads runs of digits and spaces in linear time", () => {
    expect(run(100_000)?.image).toEqual({
      url: "u",
      size: "auto",
      position: { x: "center", y: "center" },
      repeat: false,
    });
    expectLinear((n) => () => run(n), 8_000);
  });
});

describe("readUnlayerBackgroundImage edge cases", () => {
  it("reads an auto size and a keyword customPosition exactly", () => {
    expect(
      readUnlayerBackgroundImage({ url: "u", size: "auto" }, "Row", 600),
    ).toMatchObject({
      image: { size: "auto" },
      notes: [],
    });
    expect(
      readUnlayerBackgroundImage(
        { url: "u", position: "custom", customPosition: ["left", "bottom"] },
        "Row",
        600,
      ),
    ).toMatchObject({
      image: { position: { x: "left", y: "bottom" } },
      notes: [],
    });
  });

  it("centres an unknown position keyword, with a note", () => {
    expect(
      readUnlayerBackgroundImage({ url: "u", position: "middle" }, "Row", 600),
    ).toMatchObject({
      image: { position: { x: "center", y: "center" } },
      notes: [
        'Row backgroundImage.position "middle" has no exact Templatical equivalent; imported as "center center".',
      ],
    });
  });
});
