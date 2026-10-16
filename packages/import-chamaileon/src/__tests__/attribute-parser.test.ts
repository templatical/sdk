import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  fontStack,
  parseAlignment,
  parseBorderShorthand,
  parseColor,
  parseLineStyle,
  parsePadding,
  parsePx,
  readChamaileonBackgroundImage,
} from "../attribute-parser";
import { readStyle } from "../normalize";

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

  it("tolerates extra spaces between tokens", () => {
    expect(parseLineStyle("2px  solid  #00a591")).toEqual({
      thickness: 2,
      lineStyle: "solid",
      color: "#00a591",
    });
  });

  it("returns undefined when only spaces follow the style", () => {
    expect(
      parseBorderShorthand("0px solid " + "  ".repeat(200)),
    ).toBeUndefined();
  });

  it("parses the border shorthand without a backtracking regex", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../attribute-parser.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/px\\s\+\(solid\|dashed\|dotted\)\\s\+\(\.\+\)/);
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

describe("fontStack", () => {
  it("keeps a stack's fallbacks", () => {
    expect(fontStack("Montserrat, Arial, sans-serif")).toBe(
      "Montserrat, Arial, sans-serif",
    );
  });
  it("stores a built-in's own stack as the bare name", () => {
    expect(fontStack("Arial, sans-serif")).toBe("Arial");
  });
  it("returns undefined when the value sets no font", () => {
    expect(fontStack("")).toBeUndefined();
    expect(fontStack("inherit")).toBeUndefined();
    expect(fontStack(undefined)).toBeUndefined();
    expect(fontStack(12)).toBeUndefined();
  });
});

describe("readChamaileonBackgroundImage", () => {
  it("returns null for an unset image", () => {
    expect(
      readChamaileonBackgroundImage({}, "background", "Section", 600),
    ).toBeNull();
    expect(
      readChamaileonBackgroundImage(
        { backgroundImage: "url()", backgroundSize: "auto" },
        "background",
        "Section",
        600,
      ),
    ).toBeNull();
  });

  it("reads Chamaileon's own four keys exactly", () => {
    expect(
      readChamaileonBackgroundImage(
        {
          backgroundImage: "url(https://images.chamaileon.io/mav-header.jpg)",
          backgroundSize: "auto",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        },
        "background",
        "Box",
        600,
      ),
    ).toEqual({
      image: {
        url: "https://images.chamaileon.io/mav-header.jpg",
        size: "auto",
        position: { x: "center", y: "center" },
        repeat: false,
      },
      notes: [],
    });
  });

  it("reads the content-area keys, kebab-case from 2.0 documents too", () => {
    const style = readStyle(
      {
        type: "fullwidth",
        style: {
          "content-background-image": "url('https://cdn.test/hero.jpg')",
          "content-background-size": "cover",
        },
      },
      [],
    );
    expect(
      readChamaileonBackgroundImage(style, "contentBackground", "Section", 600)
        ?.image,
    ).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: { x: "left", y: "top" },
      repeat: true,
    });
  });

  it.each([
    ["backgroundSize", "100% auto", "background-size", "cover"],
    ["backgroundSize", "50%", "background-size", "auto"],
    ["backgroundPosition", "30% 80%", "background-position", "center bottom"],
    ["backgroundRepeat", "repeat-x", "background-repeat", "repeat"],
  ])(
    "maps %s %s to the nearest keyword, with a note",
    (key, value, property, shown) => {
      expect(
        readChamaileonBackgroundImage(
          { backgroundImage: "url(u)", [key]: value },
          "background",
          "Section",
          600,
        )?.notes,
      ).toEqual([
        `Section ${property} "${value}" has no exact Templatical equivalent; imported as "${shown}".`,
      ]);
    },
  );
});

describe("readChamaileonBackgroundImage on adversarial input", () => {
  const digits = "0".repeat(100_000);
  const spaces = " ".repeat(100_000);

  it("reads runs of digits and spaces in linear time", () => {
    const run = () =>
      readChamaileonBackgroundImage(
        { backgroundImage: `url(${spaces}` },
        "background",
        "Section",
        600,
      ) ??
      readChamaileonBackgroundImage(
        {
          backgroundImage: "url(u)",
          backgroundSize: `${digits}!`,
          backgroundPosition: `${digits}! ${digits}!`,
        },
        "background",
        "Section",
        600,
      );
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("readChamaileonBackgroundImage edge cases", () => {
  const read = (style: Record<string, string>) =>
    readChamaileonBackgroundImage(
      {
        backgroundImage: "url(u)",
        ...Object.fromEntries(
          Object.entries(style).map(([k, v]) => [
            k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
            v,
          ]),
        ),
      },
      "background",
      "Section",
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
      'Section background-position "right 20px bottom 10px" has no exact Templatical equivalent; imported as "right bottom".',
    ]);
    expect(read({ "background-position": "20px 10px" })).toMatchObject({
      image: { position: { x: "left", y: "top" } },
      notes: [
        'Section background-position "20px 10px" has no exact Templatical equivalent; imported as "left top".',
      ],
    });
  });
});
