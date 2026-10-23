import { describe, expect, it } from "vitest";
import {
  createCustomBlock,
  createSectionBlock,
  createTableBlock,
  createVideoBlock,
  createWrapperBlock,
} from "@templatical/types";
import {
  scanBlock,
  scanHtml,
  stripCssComments,
  stripCssUrlsAndStrings,
} from "../../src/compatibility/scan";

describe("CSS scanner", () => {
  it("removes comments and drops an unterminated comment", () => {
    expect(stripCssComments("a/* first */b/* second */c")).toBe("abc");
    expect(stripCssComments("a/* unfinished")).toBe("a");
  });

  it("removes URLs and quoted strings containing escaped quotes", () => {
    expect(
      stripCssUrlsAndStrings("a:\"x\\\"y\"; b:'it\\'s'; c:URL(icon.png); d:1"),
    ).toBe("a:; b:; c:; d:1");
  });

  it("drops the rest after an unterminated URL or quote", () => {
    expect(stripCssUrlsAndStrings("a:1; url(icon.png")).toBe("a:1; ");
    expect(stripCssUrlsAndStrings('a:1; "unfinished')).toBe("a:1; ");
    expect(stripCssUrlsAndStrings("a:1; 'unfinished")).toBe("a:1; ");
  });

  it("handles a long adversarial escaped string promptly", () => {
    const started = performance.now();
    expect(stripCssUrlsAndStrings('"' + "\\!".repeat(50_000))).toBe("");
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("records HTML background attributes and CSS declarations", () => {
    const scan = scanHtml(
      '<div background="hero.png" style="width: 12px">x</div><style>.x{float:left}</style>',
    );
    expect(scan.urls).toEqual(["hero.png"]);
    expect(
      scan.css.map(({ prop, value, inline }) => [prop, value, inline]),
    ).toEqual([
      ["width", "12px", true],
      ["float", "left", false],
    ]);
  });

  it("scans table cells, custom render output, videos, and layout backgrounds", () => {
    const table = createTableBlock({
      rows: [{ id: "row", cells: [{ id: "cell", content: "<em>cell</em>" }] }],
    });
    expect(scanBlock(table).tags.map(({ tag }) => tag)).toEqual(["em"]);

    const custom = createCustomBlock({
      type: "example",
      name: "Example",
      fields: [],
      template: "",
    });
    custom.renderedHtml = '<img src="custom.png">';
    custom.renderedStylesheet = ".example{float:left}";
    const customScan = scanBlock(custom);
    expect(customScan.urls).toEqual(["custom.png"]);
    expect(customScan.css.map(({ prop, value }) => [prop, value])).toEqual([
      ["float", "left"],
    ]);

    expect(
      scanBlock(createVideoBlock({ thumbnailUrl: "poster.png" })).urls,
    ).toEqual(["poster.png"]);
    const image = { url: "background.png" } as NonNullable<
      ReturnType<typeof createSectionBlock>["backgroundImage"]
    >;
    expect(
      scanBlock(
        createSectionBlock({
          backgroundImage: image,
          wrapper: { backgroundImage: { url: "inner.png" } } as ReturnType<
            typeof createSectionBlock
          >["wrapper"],
        }),
      ).urls,
    ).toEqual(["background.png", "inner.png"]);
    expect(
      scanBlock(createWrapperBlock({ backgroundImage: image })).urls,
    ).toEqual(["background.png"]);
  });
});
