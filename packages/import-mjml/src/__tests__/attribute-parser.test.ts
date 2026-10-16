import { describe, expect, it } from "vitest";
import {
  parseAlignment,
  parseBorderDeclaration,
  parseBorderRadius,
  parseBorderStyle,
  parseColor,
  parseDefinitePx,
  parsePaddingShorthand,
  parsePercent,
  parsePxValue,
  readMjmlBackgroundImage,
} from "../attribute-parser";

describe("parsePxValue", () => {
  it("reads a px length", () => {
    expect(parsePxValue("24px")).toBe(24);
  });

  it("reads a bare number as px", () => {
    expect(parsePxValue("24")).toBe(24);
  });

  it("accepts a numeric input", () => {
    expect(parsePxValue(24.6)).toBe(25);
  });

  it("rounds a fractional px length", () => {
    expect(parsePxValue("33.4px")).toBe(33);
  });

  it("tolerates leading whitespace", () => {
    expect(parsePxValue(" 24px")).toBe(24);
  });

  it("returns 0 for a missing value", () => {
    expect(parsePxValue(undefined)).toBe(0);
  });

  it("returns 0 for a unit it cannot express", () => {
    expect(parsePxValue("2em")).toBe(0);
  });
});

describe("parseDefinitePx", () => {
  it("reads a px length", () => {
    expect(parseDefinitePx("200px")).toBe(200);
  });

  it("reads a bare number as px", () => {
    expect(parseDefinitePx("200")).toBe(200);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseDefinitePx(" 200px ")).toBe(200);
  });

  it("returns null for a percentage", () => {
    expect(parseDefinitePx("50%")).toBe(null);
  });

  it("returns null for a missing value", () => {
    expect(parseDefinitePx(undefined)).toBe(null);
  });

  it("returns null for a unit it cannot express", () => {
    expect(parseDefinitePx("2em")).toBe(null);
  });
});

describe("parseColor", () => {
  it("passes through 6-digit hex, lowercased", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });

  it("converts rgb() to hex", () => {
    expect(parseColor("rgb(255, 0, 128)")).toBe("#ff0080");
  });

  it("drops the alpha channel of rgba()", () => {
    expect(parseColor("rgba(255, 0, 128, 0.5)")).toBe("#ff0080");
  });

  it("maps a named colour", () => {
    expect(parseColor("white")).toBe("#ffffff");
  });

  it("returns an empty string for transparent", () => {
    expect(parseColor("transparent")).toBe("");
  });

  it("returns an empty string for an unknown value", () => {
    expect(parseColor("hsl(200 50% 50%)")).toBe("");
  });

  it("returns an empty string for a missing value", () => {
    expect(parseColor(undefined)).toBe("");
  });
});

describe("parsePaddingShorthand", () => {
  it("expands one value to all four sides", () => {
    expect(parsePaddingShorthand("10px")).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("expands two values to vertical/horizontal", () => {
    expect(parsePaddingShorthand("10px 20px")).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });

  it("expands three values, mirroring the horizontal", () => {
    expect(parsePaddingShorthand("10px 20px 30px")).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 20,
    });
  });

  it("reads four values clockwise", () => {
    expect(parsePaddingShorthand("1px 2px 3px 4px")).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it("returns zeroes for a missing value", () => {
    expect(parsePaddingShorthand(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("parseAlignment", () => {
  it("passes through a supported alignment", () => {
    expect(parseAlignment("right")).toBe("right");
  });

  it("falls back for an unsupported alignment", () => {
    expect(parseAlignment("justify")).toBe("left");
  });

  it("honours an explicit fallback", () => {
    expect(parseAlignment(undefined, "center")).toBe("center");
  });
});

describe("parsePercent", () => {
  it("reads a percentage", () => {
    expect(parsePercent("33.33%")).toBe(33.33);
  });

  it("returns null for a px length", () => {
    expect(parsePercent("200px")).toBe(null);
  });

  it("returns null for a missing value", () => {
    expect(parsePercent(undefined)).toBe(null);
  });
});

describe("parseBorderStyle", () => {
  it("passes through a style the block model supports", () => {
    expect(parseBorderStyle("dashed")).toBe("dashed");
  });

  it("falls back to solid for a style it does not", () => {
    expect(parseBorderStyle("groove")).toBe("solid");
  });

  it("falls back to solid for a missing value", () => {
    expect(parseBorderStyle(undefined)).toBe("solid");
  });
});

describe("parseBorderRadius", () => {
  it("reads one px length as a single radius", () => {
    expect(parseBorderRadius("8px")).toBe(8);
    expect(parseBorderRadius("8")).toBe(8);
    expect(parseBorderRadius("0px")).toBe(0);
  });

  it("rounds a fractional px length", () => {
    expect(parseBorderRadius("4.6px")).toBe(5);
  });

  it("reads four values as top-left, top-right, bottom-right, bottom-left", () => {
    expect(parseBorderRadius("8px 0px 4px 2px")).toEqual({
      topLeft: 8,
      topRight: 0,
      bottomRight: 4,
      bottomLeft: 2,
    });
  });

  it("expands two and three values the way CSS does", () => {
    expect(parseBorderRadius("8px 0")).toEqual({
      topLeft: 8,
      topRight: 0,
      bottomRight: 8,
      bottomLeft: 0,
    });
    expect(parseBorderRadius("8px 0 4px")).toEqual({
      topLeft: 8,
      topRight: 0,
      bottomRight: 4,
      bottomLeft: 0,
    });
  });

  it("collapses four matching corners to a single radius", () => {
    expect(parseBorderRadius("6px 6px 6px 6px")).toBe(6);
    expect(parseBorderRadius("0 0")).toBe(0);
  });

  it("returns null for a value with no px reading", () => {
    for (const raw of [
      "50%",
      "1em",
      "8px / 4px",
      "-4px",
      "8px -4px",
      "1px 2px 3px 4px 5px",
      "",
    ]) {
      expect(parseBorderRadius(raw)).toBe(null);
    }
  });
});

describe("parseBorderDeclaration", () => {
  it("reads width, style and colour", () => {
    expect(parseBorderDeclaration("2px dashed #00ff00")).toEqual({
      side: { width: 2, style: "dashed", color: "#00ff00" },
    });
  });

  it("reads the three parts in any order", () => {
    expect(parseBorderDeclaration("#00FF00 dotted 3")).toEqual({
      side: { width: 3, style: "dotted", color: "#00ff00" },
    });
  });

  it("reads a colour function that holds spaces", () => {
    expect(parseBorderDeclaration("1px solid rgb(255, 0, 0)")).toEqual({
      side: { width: 1, style: "solid", color: "#ff0000" },
    });
  });

  it("reads a missing or unknown colour as unset", () => {
    expect(parseBorderDeclaration("2px solid")).toEqual({
      side: { width: 2, style: "solid", color: "" },
    });
    expect(parseBorderDeclaration("2px solid currentColor")).toEqual({
      side: { width: 2, style: "solid", color: "" },
    });
  });

  it("narrows a style the block model lacks to solid and names it", () => {
    expect(parseBorderDeclaration("3px double #000000")).toEqual({
      side: { width: 3, style: "solid", color: "#000000" },
      narrowedFrom: "double",
    });
    expect(parseBorderDeclaration("3px GROOVE #000000")).toEqual({
      side: { width: 3, style: "solid", color: "#000000" },
      narrowedFrom: "groove",
    });
  });

  it("reads a border CSS does not draw as undrawn", () => {
    for (const raw of [
      "none",
      "0",
      "0px solid #000000",
      "2px hidden #000000",
      "2px #000000",
      "",
    ]) {
      expect(parseBorderDeclaration(raw)).toEqual({ side: null });
    }
  });

  it("returns null for a drawn border it cannot read as one px width, style and colour", () => {
    for (const raw of [
      "2em solid red",
      "thin solid red",
      "solid red",
      "-2px solid red",
      "2px solid red blue",
      "2px 3px solid",
      "2px solid dashed",
    ]) {
      expect(parseBorderDeclaration(raw)).toBe(null);
    }
  });
});

describe("readMjmlBackgroundImage", () => {
  const read = (attrs: Record<string, string>, boxWidth = 600) =>
    readMjmlBackgroundImage((name) => attrs[name], "Section", boxWidth);

  it("returns null without a background-url", () => {
    expect(read({})).toBeNull();
    expect(read({ "background-url": "   " })).toBeNull();
  });

  it("gives unset longhands MJML's own defaults, so the image paints as it did", () => {
    expect(read({ "background-url": " https://cdn.test/hero.jpg " })).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "center", y: "top" },
        repeat: true,
      },
      notes: [],
    });
  });

  it("reads the renderer's own output exactly", () => {
    expect(
      read({
        "background-url": "https://cdn.test/hero.jpg",
        "background-size": "cover",
        "background-position": "center top",
        "background-repeat": "no-repeat",
      }),
    ).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "cover",
        position: { x: "center", y: "top" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("keeps a merge tag URL verbatim", () => {
    expect(read({ "background-url": "{{ hero_url }}" })?.image.url).toBe(
      "{{ hero_url }}",
    );
  });

  it.each([
    ["top left", { x: "left", y: "top" }],
    ["left top", { x: "left", y: "top" }],
    ["center right", { x: "right", y: "center" }],
    ["bottom", { x: "center", y: "bottom" }],
    ["right", { x: "right", y: "center" }],
    ["0% 100%", { x: "left", y: "bottom" }],
    ["50% 50%", { x: "center", y: "center" }],
    ["0 0", { x: "left", y: "top" }],
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
    ["25% 75%", { x: "center", y: "center" }],
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

  it("lets background-position-x and -y override the position's axes", () => {
    const result = read({
      "background-url": "u",
      "background-position": "left top",
      "background-position-x": "right",
      "background-position-y": "bottom",
    });
    expect(result?.image.position).toEqual({ x: "right", y: "bottom" });
    expect(result?.notes).toEqual([]);
  });

  it.each([
    ["contain", "contain"],
    ["auto", "auto"],
    ["auto auto", "auto"],
  ])("reads size %s exactly", (size, expected) => {
    const result = read({ "background-url": "u", "background-size": size });
    expect(result?.image.size).toBe(expected);
    expect(result?.notes).toEqual([]);
  });

  it.each([
    ["100%", "cover"],
    ["100% auto", "cover"],
    ["auto 100%", "cover"],
    ["600px", "cover"],
    ["50%", "auto"],
    ["200px", "auto"],
    ["200px 100px", "auto"],
  ])("maps size %s to %s, with a note", (size, expected) => {
    const result = read({ "background-url": "u", "background-size": size });
    expect(result?.image.size).toBe(expected);
    expect(result?.notes).toEqual([
      `Section background-size "${size}" has no exact Templatical equivalent; imported as "${expected}".`,
    ]);
  });

  it("measures a px size against the box it paints", () => {
    expect(
      read({ "background-url": "u", "background-size": "600px" }, 640)?.image
        .size,
    ).toBe("auto");
  });

  it.each(["repeat-x", "repeat-y", "round", "space", "repeat no-repeat"])(
    "tiles background-repeat %s, with a note",
    (repeat) => {
      const result = read({
        "background-url": "u",
        "background-repeat": repeat,
      });
      expect(result?.image.repeat).toBe(true);
      expect(result?.notes).toEqual([
        `Section background-repeat "${repeat}" has no exact Templatical equivalent; imported as "repeat".`,
      ]);
    },
  );
});
