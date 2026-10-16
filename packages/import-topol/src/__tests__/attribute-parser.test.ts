import { describe, expect, it } from "vitest";
import {
  attr,
  numAttr,
  parseAlignment,
  parseBorderStyle,
  parseColor,
  parsePadding,
  parsePercent,
  parsePxValue,
  readMjmlBackgroundImage,
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

describe("readMjmlBackgroundImage", () => {
  const read = (attrs: Record<string, string>, boxWidth = 600) =>
    readMjmlBackgroundImage((name) => attrs[name], "Section", boxWidth);

  it("returns null without a background-url", () => {
    expect(read({})).toBeNull();
    expect(read({ "background-url": "  " })).toBeNull();
  });

  it("gives unset attributes MJML's defaults", () => {
    expect(read({ "background-url": "https://cdn.test/hero.jpg" })).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "center", y: "top" },
        repeat: true,
      },
      notes: [],
    });
  });

  it.each([
    ["top left", { x: "left", y: "top" }],
    ["center right", { x: "right", y: "center" }],
    ["bottom", { x: "center", y: "bottom" }],
    ["0% 100%", { x: "left", y: "bottom" }],
  ])("reads position %s exactly", (position, expected) => {
    const result = read({
      "background-url": "u",
      "background-position": position,
    });
    expect(result?.image.position).toEqual(expected);
    expect(result?.notes).toEqual([]);
  });

  it.each([
    ["30% 80%", { x: "center", y: "bottom" }],
    ["20px 0", { x: "left", y: "top" }],
    ["right 20px bottom 10px", { x: "right", y: "bottom" }],
  ])(
    "snaps position %s to the nearest grid point, with a note",
    (position, expected) => {
      const result = read({
        "background-url": "u",
        "background-position": position,
      });
      expect(result?.image.position).toEqual(expected);
      expect(result?.notes).toEqual([
        `Section background-position "${position}" has no exact Templatical equivalent; imported as "${expected.x} ${expected.y}".`,
      ]);
    },
  );

  it.each([
    ["100% auto", "cover"],
    ["600px", "cover"],
    ["50%", "auto"],
  ])("maps size %s to %s, with a note", (size, expected) => {
    const result = read({ "background-url": "u", "background-size": size });
    expect(result?.image.size).toBe(expected);
    expect(result?.notes).toEqual([
      `Section background-size "${size}" has no exact Templatical equivalent; imported as "${expected}".`,
    ]);
  });

  it("reads cover, contain and no-repeat exactly", () => {
    expect(
      read({
        "background-url": "u",
        "background-size": "contain",
        "background-repeat": "no-repeat",
      }),
    ).toEqual({
      image: {
        url: "u",
        size: "contain",
        position: { x: "center", y: "top" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("tiles repeat-x, with a note", () => {
    expect(
      read({ "background-url": "u", "background-repeat": "repeat-x" })?.notes,
    ).toEqual([
      'Section background-repeat "repeat-x" has no exact Templatical equivalent; imported as "repeat".',
    ]);
  });
});

describe("readMjmlBackgroundImage on adversarial input", () => {
  const digits = "0".repeat(100_000);

  it("reads runs of digits in linear time", () => {
    const attrs: Record<string, string> = {
      "background-url": "u",
      "background-size": `${digits}!`,
      "background-position": `${digits}! ${digits}!`,
      "background-position-x": `${digits}!`,
    };
    const run = () =>
      readMjmlBackgroundImage((name) => attrs[name], "Section", 600);
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("readMjmlBackgroundImage edge cases", () => {
  const read = (attrs: Record<string, string>) =>
    readMjmlBackgroundImage((name) => attrs[name], "Section", 600);

  it("reads auto size and single-keyword positions exactly", () => {
    expect(
      read({ "background-url": "u", "background-size": "auto" })?.image.size,
    ).toBe("auto");
    expect(
      read({ "background-url": "u", "background-position": "bottom" }),
    ).toMatchObject({
      image: { position: { x: "center", y: "bottom" } },
      notes: [],
    });
    expect(
      read({ "background-url": "u", "background-position": "left" }),
    ).toMatchObject({
      image: { position: { x: "left", y: "center" } },
      notes: [],
    });
  });

  it("keeps the edge keywords of an offset position, with a note", () => {
    expect(
      read({
        "background-url": "u",
        "background-position": "right 20px bottom 10px",
      }),
    ).toEqual({
      image: {
        url: "u",
        size: "auto",
        position: { x: "right", y: "bottom" },
        repeat: true,
      },
      notes: [
        'Section background-position "right 20px bottom 10px" has no exact Templatical equivalent; imported as "right bottom".',
      ],
    });
  });

  it("notes lossy background-position-x and -y values", () => {
    expect(
      read({
        "background-url": "u",
        "background-position-x": "30%",
        "background-position-y": "10px",
      }),
    ).toEqual({
      image: {
        url: "u",
        size: "auto",
        position: { x: "center", y: "top" },
        repeat: true,
      },
      notes: [
        'Section background-position-x "30%" has no exact Templatical equivalent; imported as "center".',
        'Section background-position-y "10px" has no exact Templatical equivalent; imported as "top".',
      ],
    });
  });
});

describe("readMjmlBackgroundImage position overrides and the position note", () => {
  const read = (attrs: Record<string, string>) =>
    readMjmlBackgroundImage(
      (name) => ({ "background-url": "u", ...attrs })[name],
      "Section",
      600,
    );

  it("names the position imported after an override", () => {
    expect(
      read({
        "background-position": "30% 80%",
        "background-position-x": "left",
      }),
    ).toMatchObject({
      image: { position: { x: "left", y: "bottom" } },
      notes: [
        'Section background-position "30% 80%" has no exact Templatical equivalent; imported as "left bottom".',
      ],
    });
  });

  it("drops the note when an exact override replaces the only lossy axis", () => {
    expect(
      read({
        "background-position": "30% bottom",
        "background-position-x": "left",
      }),
    ).toMatchObject({
      image: { position: { x: "left", y: "bottom" } },
      notes: [],
    });
  });

  it("drops an offset position's note when both axes are overridden exactly", () => {
    expect(
      read({
        "background-position": "right 20px bottom 10px",
        "background-position-x": "left",
        "background-position-y": "top",
      }),
    ).toMatchObject({
      image: { position: { x: "left", y: "top" } },
      notes: [],
    });
  });

  it("keeps the position's axis, and its note, when the override is unreadable", () => {
    expect(
      read({
        "background-position": "30% 80%",
        "background-position-x": "sideways",
      }),
    ).toMatchObject({
      image: { position: { x: "center", y: "bottom" } },
      notes: [
        'Section background-position "30% 80%" has no exact Templatical equivalent; imported as "center bottom".',
        'Section background-position-x "sideways" has no exact Templatical equivalent; imported as "center".',
      ],
    });
  });
});
