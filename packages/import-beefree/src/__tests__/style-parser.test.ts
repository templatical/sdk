import { describe, it, expect } from "vitest";
import {
  parsePxValue,
  parseColor,
  parseBorderTop,
  extractPadding,
  parseDividerWidth,
  readBeefreeBackgroundImage,
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

describe("readBeefreeBackgroundImage", () => {
  const read = (style: Record<string, string>, boxWidth = 600) =>
    readBeefreeBackgroundImage(style, "Row", boxWidth);

  it("returns null without an image", () => {
    expect(readBeefreeBackgroundImage(undefined, "Row", 600)).toBeNull();
    expect(read({ "background-image": "none" })).toBeNull();
    expect(read({ "background-image": "url()" })).toBeNull();
    expect(read({ "background-color": "#ffffff" })).toBeNull();
  });

  it("gives unset longhands CSS's initial values", () => {
    expect(
      read({ "background-image": "url(https://cdn.test/hero.jpg)" }),
    ).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: true,
      },
      notes: [],
    });
  });

  it.each([
    ['url("https://cdn.test/a.png")', "https://cdn.test/a.png"],
    ["url('https://cdn.test/a.png')", "https://cdn.test/a.png"],
    ["url( https://cdn.test/a.png )", "https://cdn.test/a.png"],
  ])("unquotes %s", (value, expected) => {
    expect(read({ "background-image": value })?.image.url).toBe(expected);
  });

  it("reads BeeFree's own longhands exactly", () => {
    expect(
      read({
        "background-image": "url(https://cdn.test/hero.jpg)",
        "background-position": "top left",
        "background-repeat": "no-repeat",
      }),
    ).toEqual({
      image: {
        url: "https://cdn.test/hero.jpg",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: false,
      },
      notes: [],
    });
  });

  it.each([
    ["background-size", "100%", "cover"],
    ["background-size", "50%", "auto"],
    ["background-position", "30% 80%", "center bottom"],
    ["background-repeat", "repeat-x", "repeat"],
  ])("maps %s %s to %s, with a note", (property, value, shown) => {
    expect(
      read({ "background-image": "url(u)", [property]: value })?.notes,
    ).toEqual([
      `Row ${property} "${value}" has no exact Templatical equivalent; imported as "${shown}".`,
    ]);
  });
});

describe("readBeefreeBackgroundImage on adversarial input", () => {
  const digits = "0".repeat(100_000);
  const spaces = " ".repeat(100_000);

  it("reads runs of digits and spaces in linear time", () => {
    const run = () =>
      readBeefreeBackgroundImage(
        {
          "background-image": `url(${spaces}`,
          "background-size": `${digits}!`,
          "background-position": `${digits}! ${digits}!`,
        },
        "Row",
        600,
      ) ??
      readBeefreeBackgroundImage(
        {
          "background-image": "url(u)",
          "background-size": `${digits}!`,
          "background-position": `${digits}! ${digits}!`,
        },
        "Row",
        600,
      );
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("readBeefreeBackgroundImage edge cases", () => {
  const read = (style: Record<string, string>) =>
    readBeefreeBackgroundImage(
      { "background-image": "url(u)", ...style },
      "Row",
      600,
    );

  it("reads contain, auto and single-keyword positions exactly", () => {
    expect(read({ "background-size": "contain" })?.image.size).toBe("contain");
    expect(read({ "background-size": "auto" })).toMatchObject({
      image: { size: "auto" },
      notes: [],
    });
    expect(read({ "background-position": "bottom" })).toMatchObject({
      image: { position: { x: "center", y: "bottom" } },
      notes: [],
    });
    expect(read({ "background-position": "left" })).toMatchObject({
      image: { position: { x: "left", y: "center" } },
      notes: [],
    });
    expect(read({ "background-repeat": "no-repeat" })).toMatchObject({
      image: { repeat: false },
      notes: [],
    });
  });

  it("maps offsets and lengths to the edge they start from, with a note", () => {
    expect(
      read({ "background-position": "right 20px bottom 10px" })?.notes,
    ).toEqual([
      'Row background-position "right 20px bottom 10px" has no exact Templatical equivalent; imported as "right bottom".',
    ]);
    expect(read({ "background-position": "20px 10px" })).toMatchObject({
      image: { position: { x: "left", y: "top" } },
      notes: [
        'Row background-position "20px 10px" has no exact Templatical equivalent; imported as "left top".',
      ],
    });
  });
});
