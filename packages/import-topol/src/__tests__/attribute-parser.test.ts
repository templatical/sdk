import { describe, expect, it } from "vitest";
import {
  attr,
  numAttr,
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parseFontFamily,
  parsePadding,
  parsePercent,
  parsePxValue,
} from "../attribute-parser";
import type { TopolNode } from "../types";

const node = (attributes: Record<string, unknown>): TopolNode =>
  ({ tagName: "mj-text", attributes }) as TopolNode;

describe("attr — the null-safe reader", () => {
  it("reads a string attribute", () => {
    expect(attr(node({ href: "https://x.test" }), "href")).toBe(
      "https://x.test",
    );
  });

  it("treats an explicit null as absent", () => {
    expect(attr(node({ href: null }), "href")).toBeUndefined();
  });

  it("treats an absent key as absent", () => {
    expect(attr(node({}), "href")).toBeUndefined();
  });

  it("treats an empty string as absent", () => {
    expect(attr(node({ href: "" }), "href")).toBeUndefined();
  });

  it("stringifies a numeric attribute", () => {
    expect(attr(node({ "font-size": 15 }), "font-size")).toBe("15");
  });

  it("returns undefined when the node has no attributes object", () => {
    expect(attr({ tagName: "mj-text" } as TopolNode, "href")).toBeUndefined();
  });

  it("returns undefined for a non-scalar attribute value", () => {
    expect(attr(node({ style: { color: "red" } }), "style")).toBeUndefined();
  });

  it("returns a boolean attribute stringified", () => {
    expect(attr(node({ enabled: true }), "enabled")).toBe("true");
  });
});

describe("numAttr", () => {
  it("reads a number", () => {
    expect(numAttr(node({ width: 78 }), "width")).toBe(78);
  });

  it("reads a numeric string", () => {
    expect(numAttr(node({ width: "78" }), "width")).toBe(78);
  });

  it("returns undefined for an explicit null", () => {
    expect(numAttr(node({ width: null }), "width")).toBeUndefined();
  });

  it("returns undefined for a non-numeric string", () => {
    expect(numAttr(node({ width: "auto" }), "width")).toBeUndefined();
  });
});

describe("parsePxValue", () => {
  it("reads a px length", () => {
    expect(parsePxValue("24px")).toBe(24);
  });
  it("reads a bare number", () => {
    expect(parsePxValue(24)).toBe(24);
  });
  it("rounds a fraction", () => {
    expect(parsePxValue("33.4px")).toBe(33);
  });
  it("returns 0 for a missing value", () => {
    expect(parsePxValue(undefined)).toBe(0);
  });
  it("returns 0 for a unit it cannot express", () => {
    expect(parsePxValue("2em")).toBe(0);
  });
  it("tolerates surrounding whitespace", () => {
    expect(parsePxValue(" 24px ")).toBe(24);
  });
  it("parses negative numbers", () => {
    expect(parsePxValue("-24px")).toBe(-24);
  });
  it("rejects a space between the number and the unit", () => {
    // Internal whitespace is not valid CSS and is not something Topol emits;
    // rejecting it (rather than tolerating it like the surrounding trim)
    // keeps the match pattern unambiguous — see the ReDoS test below.
    expect(parsePxValue("24 px")).toBe(0);
  });
  it("resolves a value with no trailing unit in linear time", () => {
    // Adversarial input for the pre-fix pattern `/^\s*(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/`:
    // a long run of trailing spaces followed by a non-matching character. The
    // failing match retried every split of that run between the two `\s*`
    // groups, which is polynomial in the run's length. At 80 KB the old
    // pattern took over ten seconds (measured); this asserts the fixed one
    // resolves in well under a second.
    const input = "0" + " ".repeat(80_000) + "x";
    const start = performance.now();
    const result = parsePxValue(input);
    const elapsed = performance.now() - start;
    expect(result).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("parseColor", () => {
  it("lowercases 6-digit hex", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });
  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });
  it("converts rgb()", () => {
    expect(parseColor("rgb(255, 0, 128)")).toBe("#ff0080");
  });
  it("maps a named colour", () => {
    expect(parseColor("white")).toBe("#ffffff");
  });
  it("returns empty for none", () => {
    expect(parseColor("none")).toBe("");
  });
  it("returns empty for a missing value", () => {
    expect(parseColor(undefined)).toBe("");
  });
  it("returns empty for an unrecognized named color", () => {
    expect(parseColor("chartreuse")).toBe("");
  });
});

describe("parsePadding — both Topol forms", () => {
  it("reads the shorthand string form", () => {
    expect(parsePadding(node({ padding: "9px 8px 7px 6px" }))).toEqual({
      top: 9,
      right: 8,
      bottom: 7,
      left: 6,
    });
  });

  it("expands a one-value shorthand", () => {
    expect(parsePadding(node({ padding: "10px" }))).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("reads the separate numeric form used by mj-divider", () => {
    expect(
      parsePadding(
        node({
          "padding-top": 24,
          "padding-right": 22,
          "padding-bottom": 10,
          "padding-left": 25,
        }),
      ),
    ).toEqual({ top: 24, right: 22, bottom: 10, left: 25 });
  });

  it("lets a separate key override the shorthand", () => {
    expect(
      parsePadding(node({ padding: "9px 9px 9px 9px", "padding-top": 24 })),
    ).toEqual({
      top: 24,
      right: 9,
      bottom: 9,
      left: 9,
    });
  });

  it("returns zeroes when no padding is declared", () => {
    expect(parsePadding(node({}))).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("expands a two-value shorthand", () => {
    expect(parsePadding(node({ padding: "12px 18px" }))).toEqual({
      top: 12,
      right: 18,
      bottom: 12,
      left: 18,
    });
  });

  it("expands a three-value shorthand", () => {
    expect(parsePadding(node({ padding: "5px 10px 15px" }))).toEqual({
      top: 5,
      right: 10,
      bottom: 15,
      left: 10,
    });
  });
});

describe("parsePercent", () => {
  it("reads a percent string", () => {
    expect(parsePercent("50%")).toBe(50);
  });
  it("reads a bare number as a percent", () => {
    expect(parsePercent(25)).toBe(25);
  });
  it("returns null for a px value", () => {
    expect(parsePercent("200px")).toBe(null);
  });
  it("returns null for a missing value", () => {
    expect(parsePercent(undefined)).toBe(null);
  });
  it("returns 0 for a zero percent string", () => {
    expect(parsePercent("0%")).toBe(0);
  });
  it("returns 0 for a zero numeric value", () => {
    expect(parsePercent(0)).toBe(0);
  });
});

describe("parseFontFamily", () => {
  it("returns the first family unquoted", () => {
    expect(parseFontFamily("'Helvetica Neue', Helvetica, sans-serif")).toBe(
      "Helvetica Neue",
    );
  });
  it("returns empty for a missing value", () => {
    expect(parseFontFamily(undefined)).toBe("");
  });
});

describe("parseAlignment", () => {
  it("passes a supported value", () => {
    expect(parseAlignment("right")).toBe("right");
  });
  it("falls back for an unsupported value", () => {
    expect(parseAlignment("justify")).toBe("left");
  });
  it("honours an explicit fallback", () => {
    expect(parseAlignment(undefined, "center")).toBe("center");
  });
});

describe("parseBorderStyle", () => {
  it("passes a supported style", () => {
    expect(parseBorderStyle("dashed")).toBe("dashed");
  });
  it("falls back to solid", () => {
    expect(parseBorderStyle("groove")).toBe("solid");
  });
  it("passes dotted style", () => {
    expect(parseBorderStyle("dotted")).toBe("dotted");
  });
});
