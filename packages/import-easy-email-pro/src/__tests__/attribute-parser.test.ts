import { describe, expect, it } from "vitest";
import {
  parseColor,
  parsePercent,
  parsePx,
  readMjmlBackgroundImage,
  readPadding,
} from "../attribute-parser";

describe("parsePx", () => {
  it("parses 10px", () => {
    expect(parsePx("10px")).toBe(10);
  });
  it("parses a number", () => {
    expect(parsePx(12)).toBe(12);
  });
  it("returns undefined for unset", () => {
    expect(parsePx("")).toBe(undefined);
  });
});

describe("parsePercent", () => {
  it("parses 50%", () => {
    expect(parsePercent("50%")).toBe(50);
  });
  it("parses 33.33%", () => {
    expect(parsePercent("33.33%")).toBe(33.33);
  });
  it("returns null for missing", () => {
    expect(parsePercent(undefined)).toBe(null);
  });
  it("returns null for empty", () => {
    expect(parsePercent("")).toBe(null);
  });
});

describe("parseColor", () => {
  it("keeps a hex colour", () => {
    expect(parseColor("#8C9A80")).toBe("#8C9A80");
  });
  it("returns undefined for unset", () => {
    expect(parseColor("transparent")).toBe(undefined);
  });
});

describe("readPadding", () => {
  it("reads the four sides", () => {
    const attrs: Record<string, string> = {
      "padding-top": "25px",
      "padding-bottom": "25px",
      "padding-left": "0px",
      "padding-right": "0px",
    };
    expect(readPadding((k) => attrs[k])).toEqual({
      top: 25,
      right: 0,
      bottom: 25,
      left: 0,
    });
  });
  it("defaults a missing side to 0", () => {
    expect(readPadding(() => undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("readMjmlBackgroundImage", () => {
  const read = (attrs: Record<string, unknown>, boxWidth = 600) =>
    readMjmlBackgroundImage((name) => attrs[name], "Section", boxWidth);

  it("returns null for an unset background-url", () => {
    expect(read({})).toBeNull();
    expect(read({ "background-url": "" })).toBeNull();
    expect(read({ "background-url": "url()" })).toBeNull();
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

  it("reads cover and no-repeat exactly, and tiles repeat-y with a note", () => {
    expect(
      read({
        "background-url": "u",
        "background-size": "cover",
        "background-repeat": "no-repeat",
      })?.image,
    ).toEqual({
      url: "u",
      size: "cover",
      position: { x: "center", y: "top" },
      repeat: false,
    });
    expect(
      read({ "background-url": "u", "background-repeat": "repeat-y" })?.notes,
    ).toEqual([
      'Section background-repeat "repeat-y" has no exact Templatical equivalent; imported as "repeat".',
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
