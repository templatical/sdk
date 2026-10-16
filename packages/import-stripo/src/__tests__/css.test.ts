import { describe, expect, it } from "vitest";
import {
  colorFromPaint,
  imageFromPaint,
  parseColor,
  parsePaddingShorthand,
  parsePxValue,
  parseStyleAttribute,
  readCssBackground,
  resolveSectionImage,
  resolveSectionPaint,
  withoutBandOverImage,
} from "../css";
import type { ReadBackgroundImage } from "../css";

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

describe("parseStyleAttribute — semicolons inside a value", () => {
  it("doesn't split inside url() or quotes", () => {
    expect(
      parseStyleAttribute(
        'background-image:url("https://cdn.example/a.png?x=1;y=2");color:red',
      ),
    ).toEqual({
      "background-image": 'url("https://cdn.example/a.png?x=1;y=2")',
      color: "red",
    });
  });

  it("keeps declarations after a quote that never closes", () => {
    expect(
      parseStyleAttribute("font-family:'Open Sans;background-color:#abcdef"),
    ).toMatchObject({ "background-color": "#abcdef" });
  });
});

describe("readCssBackground", () => {
  it("gives unset longhands CSS's initial values", () => {
    expect(
      readCssBackground(
        { "background-image": "url(https://cdn.example/a.png)" },
        "Section",
        600,
      ),
    ).toEqual({
      image: {
        url: "https://cdn.example/a.png",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: true,
      },
      notes: [],
    });
  });

  it("reads Stripo's own longhands exactly", () => {
    expect(
      readCssBackground(
        {
          "background-image": "url(https://cdn.example/a.png)",
          "background-repeat": "no-repeat",
          "background-position": "center top",
          "background-size": "cover",
        },
        "Section",
        600,
      )?.image,
    ).toEqual({
      url: "https://cdn.example/a.png",
      size: "cover",
      position: { x: "center", y: "top" },
      repeat: false,
    });
  });

  it("reads a shorthand's image and keeps the first of several layers, noted", () => {
    expect(
      readCssBackground(
        { background: "url(a.png) no-repeat, url(b.png)" },
        "Section",
        600,
      ),
    ).toEqual({
      image: {
        url: "a.png",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: false,
      },
      notes: [
        'Section background has 2 layers; only the image "a.png" was imported.',
      ],
    });
  });

  it.each([
    ["background-size", "100%", "cover"],
    ["background-position", "30% 80%", "center bottom"],
    ["background-repeat", "repeat-y", "repeat"],
  ])("maps %s %s to %s, with a note", (property, value, shown) => {
    expect(
      readCssBackground(
        { "background-image": "url(u)", [property]: value },
        "Section",
        600,
      )?.notes,
    ).toEqual([
      `Section ${property} "${value}" has no exact Templatical equivalent; imported as "${shown}".`,
    ]);
  });
});

describe("imageFromPaint", () => {
  it("reads inline CSS, else the background attribute", () => {
    expect(
      imageFromPaint(
        "background-image:url(https://cdn.example/a.png)",
        undefined,
        "Section",
        600,
      )?.image.url,
    ).toBe("https://cdn.example/a.png");
    expect(
      imageFromPaint(undefined, "https://cdn.example/b.png", "Section", 600)
        ?.image,
    ).toEqual({
      url: "https://cdn.example/b.png",
      size: "auto",
      position: { x: "left", y: "top" },
      repeat: true,
    });
  });

  it("lets a CSS background declaration override the attribute", () => {
    expect(
      imageFromPaint(
        "background:#ffffff",
        "https://cdn.example/b.png",
        "Section",
        600,
      ),
    ).toBeNull();
  });

  it("reads no image from repeat and position alone, as Stripo's wrapper writes them", () => {
    expect(
      imageFromPaint(
        "background-repeat:repeat;background-position:center top;background-color:#F3F4F6",
        undefined,
        "Page",
        600,
      ),
    ).toBeNull();
  });
});

describe("resolveSectionImage", () => {
  const read = (url: string): ReadBackgroundImage => ({
    image: {
      url,
      size: "cover",
      position: { x: "center", y: "center" },
      repeat: false,
    },
    notes: [],
  });
  const layer = (url: string) => ({ read: read(url), source: { url } });
  const base = {
    structure: null,
    body: null,
    band: null,
    columns: [] as Array<ReadBackgroundImage | null>,
    bodyPainted: false,
  };

  it("prefers the structure, then the body", () => {
    expect(
      resolveSectionImage({ ...base, structure: layer("s"), body: layer("b") })
        .image?.url,
    ).toBe("s");
    expect(resolveSectionImage({ ...base, body: layer("b") }).image?.url).toBe(
      "b",
    );
  });

  it("moves a lone or shared column image up only while the section has none", () => {
    expect(
      resolveSectionImage({ ...base, columns: [read("c")] }),
    ).toMatchObject({
      image: { url: "c" },
      notes: [],
      source: null,
    });
    expect(
      resolveSectionImage({ ...base, columns: [read("c"), read("c")] }).image
        ?.url,
    ).toBe("c");
    expect(
      resolveSectionImage({ ...base, body: layer("b"), columns: [read("c")] }),
    ).toMatchObject({
      image: { url: "b" },
      notes: [
        "The background image on column 1 was dropped. A Templatical section has one background image.",
      ],
    });
    expect(
      resolveSectionImage({ ...base, columns: [read("c"), null, read("d")] }),
    ).toMatchObject({
      image: undefined,
      notes: [
        "Background images on columns 1, 3 were dropped. A Templatical section has one background image.",
      ],
    });
  });

  it("paints the stripe only while nothing else paints the content area", () => {
    expect(
      resolveSectionImage({ ...base, band: layer("stripe") }),
    ).toMatchObject({
      image: { url: "stripe" },
      notes: [
        "The stripe's background image spans the full width in Stripo; the section paints it at the content width.",
      ],
    });
    expect(
      resolveSectionImage({
        ...base,
        band: layer("stripe"),
        bodyPainted: true,
      }),
    ).toMatchObject({
      image: undefined,
      notes: [
        "The stripe's background image outside the content width was dropped.",
      ],
    });
    expect(
      resolveSectionImage({ ...base, band: layer("stripe"), body: layer("b") }),
    ).toMatchObject({
      image: { url: "b" },
      notes: [
        "The stripe's background image outside the content width was dropped.",
      ],
    });
  });

  it("names the element the image came from, and copies the image", () => {
    const body = layer("b");
    const result = resolveSectionImage({ ...base, body });
    expect(result.source).toBe(body.source);
    expect(result.image).toEqual(body.read.image);
    expect(result.image).not.toBe(body.read.image);
  });
});

describe("withoutBandOverImage", () => {
  const banded = resolveSectionPaint("#ffffff", "#222222", "#f4f4f4");

  it("drops the band colour from a section with an image, saying so", () => {
    expect(withoutBandOverImage(banded, true)).toEqual({
      backgroundColor: "#f4f4f4",
      notes: [
        "The band colour #222222 was dropped: Outlook desktop paints a wrapper colour over the section's background image.",
      ],
    });
  });

  it("leaves the paint alone without an image, or without a band", () => {
    expect(withoutBandOverImage(banded, false)).toBe(banded);
    const plain = resolveSectionPaint("#ffffff", "", "#f4f4f4");
    expect(withoutBandOverImage(plain, true)).toBe(plain);
  });
});

describe("readCssBackground on adversarial input", () => {
  const digits = "0".repeat(100_000);
  const spaces = " ".repeat(100_000);

  it("reads runs of digits and spaces in linear time", () => {
    const run = () =>
      readCssBackground(
        { "background-image": `url(${spaces}` },
        "Section",
        600,
      ) ??
      readCssBackground(
        {
          background: `${digits}! url(u) ${digits}! / ${digits}!`,
          "background-size": `${digits}!`,
          "background-position": `${digits}! ${digits}!`,
        },
        "Section",
        600,
      );
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("readCssBackground edge cases", () => {
  const read = (styles: Record<string, string>) =>
    readCssBackground(
      { "background-image": "url(u)", ...styles },
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
  });

  it("maps offsets and lengths to the edge they start from, with a note", () => {
    expect(
      read({ "background-position": "right 20px bottom 10px" })?.notes,
    ).toEqual([
      'Section background-position "right 20px bottom 10px" has no exact Templatical equivalent; imported as "right bottom".',
    ]);
    expect(
      read({ "background-position": "20px 10px" })?.image.position,
    ).toEqual({ x: "left", y: "top" });
  });

  it("notes lossy background-position-x and -y values", () => {
    expect(
      read({ "background-position-x": "30%", "background-position-y": "10px" }),
    ).toMatchObject({
      image: { position: { x: "center", y: "top" } },
      notes: [
        'Section background-position-x "30%" has no exact Templatical equivalent; imported as "center".',
        'Section background-position-y "10px" has no exact Templatical equivalent; imported as "top".',
      ],
    });
  });

  it("reads a shorthand's quoted url, size pair and repeat", () => {
    expect(
      readCssBackground(
        { background: 'url("a b.png") left bottom / 50% auto repeat-y' },
        "Section",
        600,
      ),
    ).toEqual({
      image: {
        url: "a b.png",
        size: "auto",
        position: { x: "left", y: "bottom" },
        repeat: true,
      },
      notes: [
        'Section background-size "50% auto" has no exact Templatical equivalent; imported as "auto".',
        'Section background-repeat "repeat-y" has no exact Templatical equivalent; imported as "repeat".',
      ],
    });
  });
});

describe("readCssBackground url() scanning", () => {
  const read = (value: string) =>
    readCssBackground({ "background-image": value }, "Section", 600);

  it("reads a repeated unclosed url( in linear time", () => {
    const value = "url(" + "url(!".repeat(20_000);
    const started = performance.now();
    expect(read(value)).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it.each(['url("a.png', 'url("a.png" x)', 'url(a"b)', "url(a.png"])(
    "reads no image from the malformed %s",
    (value) => {
      expect(read(value)).toBeNull();
    },
  );

  it("unquotes the first url() and trims it", () => {
    expect(read("  URL( 'https://cdn.test/a.png' )  ")?.image.url).toBe(
      "https://cdn.test/a.png",
    );
  });
});

describe("readCssBackground position overrides and the position note", () => {
  const read = (styles: Record<string, string>) =>
    readCssBackground(
      { "background-image": "url(u)", ...styles },
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
