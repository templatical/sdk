import { describe, expect, it } from "vitest";
import {
  backgroundShorthandColor,
  parseAlignment,
  parseBackgroundShorthand,
  parseBorderShorthand,
  parseColor,
  parseFontWeight,
  parsePaddingShorthand,
  parsePxValue,
  parseStyleAttribute,
  parseWidthPercent,
  readCssBackground,
  readLegacyBackground,
  readPaddingFromStyles,
  serializeStyleAttribute,
} from "../style-parser";

describe("parseStyleAttribute", () => {
  it("parses semicolon-separated declarations into a record", () => {
    const r = parseStyleAttribute("color: red; font-size: 14px");
    expect(r).toEqual({ color: "red", "font-size": "14px" });
  });

  it("lowercases keys and trims values", () => {
    const r = parseStyleAttribute("  COLOR :  #FFF  ");
    expect(r).toEqual({ color: "#FFF" });
  });

  it("returns empty record for undefined or empty input", () => {
    expect(parseStyleAttribute(undefined)).toEqual({});
    expect(parseStyleAttribute("")).toEqual({});
    expect(parseStyleAttribute("   ")).toEqual({});
  });

  it("ignores malformed declarations without a colon", () => {
    const r = parseStyleAttribute("color: red; broken; font: 1px");
    expect(r).toEqual({ color: "red", font: "1px" });
  });

  it("preserves the last value when a key is repeated", () => {
    const r = parseStyleAttribute("color: red; color: blue");
    expect(r).toEqual({ color: "blue" });
  });
});

describe("serializeStyleAttribute", () => {
  it("serializes a record back to a CSS string", () => {
    expect(serializeStyleAttribute({ color: "red", "font-size": "14px" })).toBe(
      "color: red; font-size: 14px",
    );
  });

  it("returns empty string for empty record", () => {
    expect(serializeStyleAttribute({})).toBe("");
  });
});

describe("parsePxValue", () => {
  it("parses px-suffixed values", () => {
    expect(parsePxValue("12px")).toBe(12);
    expect(parsePxValue("12.6px")).toBe(13);
  });

  it("parses bare numeric strings", () => {
    expect(parsePxValue("8")).toBe(8);
  });

  it("returns numbers as-is (rounded)", () => {
    expect(parsePxValue(7.4)).toBe(7);
    expect(parsePxValue(7.5)).toBe(8);
  });

  it("returns 0 for missing or invalid input", () => {
    expect(parsePxValue(undefined)).toBe(0);
    expect(parsePxValue("")).toBe(0);
    expect(parsePxValue("auto")).toBe(0);
    expect(parsePxValue("2em")).toBe(0);
  });
});

describe("parseWidthPercent", () => {
  it("returns numeric percent", () => {
    expect(parseWidthPercent("75%")).toBe(75);
    expect(parseWidthPercent("33.3%")).toBe(33);
  });

  it("returns 100 for missing or non-percent", () => {
    expect(parseWidthPercent(undefined)).toBe(100);
    expect(parseWidthPercent("100px")).toBe(100);
  });
});

describe("parseColor", () => {
  it("normalizes 6-digit hex to lowercase", () => {
    expect(parseColor("#AABBCC")).toBe("#aabbcc");
  });

  it("expands 3-digit hex", () => {
    expect(parseColor("#abc")).toBe("#aabbcc");
  });

  it("converts rgb() to hex", () => {
    expect(parseColor("rgb(255, 128, 0)")).toBe("#ff8000");
  });

  it("converts rgba() to hex (drops alpha)", () => {
    expect(parseColor("rgba(255, 128, 0, 0.5)")).toBe("#ff8000");
  });

  it("resolves named colors", () => {
    expect(parseColor("red")).toBe("#ff0000");
    expect(parseColor("BLACK")).toBe("#000000");
  });

  it("returns empty for transparent / inherit / none / unknown", () => {
    expect(parseColor("transparent")).toBe("");
    expect(parseColor("inherit")).toBe("");
    expect(parseColor("none")).toBe("");
    expect(parseColor("notacolor")).toBe("");
    expect(parseColor(undefined)).toBe("");
  });
});

describe("parsePaddingShorthand", () => {
  it("expands 1-value shorthand", () => {
    expect(parsePaddingShorthand("10px")).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });

  it("expands 2-value shorthand (vertical / horizontal)", () => {
    expect(parsePaddingShorthand("10px 20px")).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });

  it("expands 3-value shorthand", () => {
    expect(parsePaddingShorthand("10px 20px 30px")).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 20,
    });
  });

  it("expands 4-value shorthand", () => {
    expect(parsePaddingShorthand("1px 2px 3px 4px")).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it("returns zeroes for missing input", () => {
    expect(parsePaddingShorthand(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });
});

describe("readPaddingFromStyles", () => {
  it("prefers longhand over shorthand", () => {
    const r = readPaddingFromStyles({
      padding: "5px",
      "padding-top": "12px",
      "padding-left": "8px",
    });
    expect(r).toEqual({ top: 12, right: 5, bottom: 5, left: 8 });
  });

  it("falls back to shorthand when no longhand", () => {
    expect(readPaddingFromStyles({ padding: "10px" })).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
  });
});

describe("parseFontWeight", () => {
  it("returns empty for default weights", () => {
    expect(parseFontWeight("normal")).toBe("");
    expect(parseFontWeight("400")).toBe("");
    expect(parseFontWeight(undefined)).toBe("");
  });

  it("returns weight for non-default values", () => {
    expect(parseFontWeight("bold")).toBe("bold");
    expect(parseFontWeight("700")).toBe("700");
  });
});

describe("parseAlignment", () => {
  it("returns recognized alignments", () => {
    expect(parseAlignment("center")).toBe("center");
    expect(parseAlignment("RIGHT")).toBe("right");
  });

  it("falls back when unrecognized", () => {
    expect(parseAlignment("justify")).toBe("left");
    expect(parseAlignment(undefined, "center")).toBe("center");
  });
});

describe("parseBorderShorthand", () => {
  it("parses 1px solid #ccc", () => {
    expect(parseBorderShorthand("1px solid #cccccc")).toEqual({
      width: 1,
      style: "solid",
      color: "#cccccc",
    });
  });

  it("is order-tolerant", () => {
    expect(parseBorderShorthand("dashed red 2px")).toEqual({
      width: 2,
      style: "dashed",
      color: "#ff0000",
    });
  });

  it("returns defaults for empty input", () => {
    expect(parseBorderShorthand(undefined)).toEqual({
      width: 0,
      style: "solid",
      color: "#000000",
    });
  });

  it("ignores unrecognized tokens", () => {
    expect(parseBorderShorthand("1px solid notacolor")).toEqual({
      width: 1,
      style: "solid",
      color: "#000000",
    });
  });
});

describe("parseStyleAttribute — semicolons inside a value", () => {
  it("doesn't split inside url() or quotes", () => {
    expect(
      parseStyleAttribute(
        "background-image:url(data:image/png;base64,AAAA);color:red",
      ),
    ).toEqual({
      "background-image": "url(data:image/png;base64,AAAA)",
      color: "red",
    });
    expect(
      parseStyleAttribute('background-image:url("a.png?x=1;y=2");padding:4px'),
    ).toEqual({
      "background-image": 'url("a.png?x=1;y=2")',
      padding: "4px",
    });
  });

  it("keeps the declarations after an unterminated quote", () => {
    expect(
      parseStyleAttribute("font-family:'Open Sans;background-color:#abcdef"),
    ).toEqual({
      "font-family": "'Open Sans",
      "background-color": "#abcdef",
    });
  });

  it("keeps the declarations after an unclosed parenthesis", () => {
    expect(parseStyleAttribute("background-image:url(a.png;color:red")).toEqual(
      {
        "background-image": "url(a.png",
        color: "red",
      },
    );
  });
});

describe("parseBackgroundShorthand", () => {
  it("reads mjml@5's section shorthand", () => {
    expect(
      parseBackgroundShorthand(
        "#222222 url('https://cdn.test/hero.jpg') center top / cover no-repeat",
      ),
    ).toEqual({
      color: "#222222",
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: "center top",
      repeat: "no-repeat",
      layers: 1,
    });
  });

  it("reads a colour-only shorthand", () => {
    expect(parseBackgroundShorthand("rgb(1, 2, 3)")).toEqual({
      color: "rgb(1, 2, 3)",
      url: "",
      size: "",
      position: "",
      repeat: "",
      layers: 1,
    });
  });

  it("takes the colour from the last layer and the image from the first with a url", () => {
    expect(
      parseBackgroundShorthand(
        "url(a.png) no-repeat, linear-gradient(#000, #fff) #123456",
      ),
    ).toEqual({
      color: "#123456",
      url: "a.png",
      size: "",
      position: "",
      repeat: "no-repeat",
      layers: 2,
    });
  });
});

describe("backgroundShorthandColor", () => {
  it("reads the colour out of a shorthand with an image", () => {
    expect(
      backgroundShorthandColor(
        "#f0e0d0 url('https://cdn.test/x.png') center top / cover no-repeat",
      ),
    ).toBe("#f0e0d0");
    expect(backgroundShorthandColor("url(x.png)")).toBe("");
    expect(backgroundShorthandColor(undefined)).toBe("");
  });
});

describe("readCssBackground", () => {
  const read = (styles: Record<string, string>, boxWidth = 600) =>
    readCssBackground(styles, "Section", boxWidth);

  it("returns null without an image", () => {
    expect(read({})).toBeNull();
    expect(read({ "background-image": "none" })).toBeNull();
    expect(read({ "background-image": "url()" })).toBeNull();
    expect(read({ background: "#ffffff" })).toBeNull();
  });

  it("gives unset longhands CSS's initial values", () => {
    expect(read({ "background-image": "url(https://cdn.test/a.png)" })).toEqual(
      {
        image: {
          url: "https://cdn.test/a.png",
          size: "auto",
          position: { x: "left", y: "top" },
          repeat: true,
        },
        notes: [],
      },
    );
  });

  it.each([
    ['url("https://cdn.test/a.png")', "https://cdn.test/a.png"],
    ["url('https://cdn.test/a.png')", "https://cdn.test/a.png"],
    ["url( https://cdn.test/a.png )", "https://cdn.test/a.png"],
    ["url({{ hero_url }})", "{{ hero_url }}"],
  ])("unquotes %s", (value, expected) => {
    expect(read({ "background-image": value })?.image.url).toBe(expected);
  });

  it("reads mjml@5's compiled section exactly", () => {
    expect(
      read({
        background:
          "#222222 url('https://cdn.test/hero.jpg') center top / cover no-repeat",
        "background-position": "center top",
        "background-repeat": "no-repeat",
        "background-size": "cover",
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

  it("lets a longhand win over the shorthand's value", () => {
    expect(
      read({
        background: "url(a.png) no-repeat",
        "background-repeat": "repeat",
      })?.image.repeat,
    ).toBe(true);
  });

  it("keeps the first image of several layers, with a note", () => {
    expect(
      read({
        "background-image": "linear-gradient(#000, #fff), url(a.png)",
        "background-size": "auto, cover",
      }),
    ).toEqual({
      image: {
        url: "a.png",
        size: "cover",
        position: { x: "left", y: "top" },
        repeat: true,
      },
      notes: [
        'Section background has 2 layers; only the image "a.png" was imported.',
      ],
    });
  });

  it.each([
    ["background-size", "100%", "cover"],
    ["background-size", "600px", "cover"],
    ["background-size", "50%", "auto"],
    ["background-position", "30% 80%", "center bottom"],
    ["background-position", "20px 0", "left top"],
    ["background-repeat", "repeat-x", "repeat"],
  ])("maps %s %s to %s, with a note", (property, value, shown) => {
    expect(
      read({ "background-image": "url(u)", [property]: value })?.notes,
    ).toEqual([
      `Section ${property} "${value}" has no exact Templatical equivalent; imported as "${shown}".`,
    ]);
  });

  it("reads keyword positions in either order exactly", () => {
    expect(
      read({
        "background-image": "url(u)",
        "background-position": "bottom right",
      }),
    ).toMatchObject({
      image: { position: { x: "right", y: "bottom" } },
      notes: [],
    });
  });
});

describe("readLegacyBackground", () => {
  it("tiles a bare background attribute from the top left, as a browser does", () => {
    expect(
      readLegacyBackground(" https://cdn.test/tile.gif ", "Section", 600),
    ).toEqual({
      image: {
        url: "https://cdn.test/tile.gif",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: true,
      },
      notes: [],
    });
    expect(readLegacyBackground("", "Section", 600)).toBeNull();
    expect(readLegacyBackground(undefined, "Section", 600)).toBeNull();
  });
});

describe("readCssBackground on adversarial input", () => {
  const run = (length: number) => {
    const digits = "0".repeat(length);
    const spaces = " ".repeat(length);
    return (
      // A layer is trimmed before its url() is read, so the spaces need a
      // character after them to reach the reader.
      readCssBackground(
        { "background-image": `url(${spaces}x` },
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
      )
    );
  };

  // Compares how the cost grows rather than a time budget, which fails on a
  // slow or busy runner: CI under coverage reads 100k characters about ten
  // times slower than a laptop. Four times the input costs about four times
  // as much when the reading is linear, and about sixteen when it is
  // quadratic. The cost is this thread's CPU time, not wall time: on a busy
  // machine the longer run is preempted more often, which pushed a
  // wall-clock ratio of linear reading past 8 in a third of the trials.
  it("reads runs of digits and spaces in linear time", () => {
    expect(run(10_000)?.image).toEqual({
      url: "u",
      size: "auto",
      position: { x: "left", y: "top" },
      repeat: true,
    });
    const cost = (length: number): number => {
      const started = process.threadCpuUsage();
      run(length);
      const { user, system } = process.threadCpuUsage(started);
      return user + system;
    };
    let small = Infinity;
    let large = Infinity;
    for (let round = 0; round < 3; round++) {
      small = Math.min(small, cost(10_000));
      large = Math.min(large, cost(40_000));
    }
    expect(large / small).toBeLessThan(8);
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
