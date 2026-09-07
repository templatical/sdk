import { describe, expect, it } from "vitest";
import { inferTextBlock, stripTags } from "../content-inference";

describe("inferTextBlock", () => {
  it("reads a single heading root as a title, keeping its level", () => {
    expect(inferTextBlock("<h3>Big news</h3>")).toEqual({
      kind: "title",
      level: 3,
      inner: "Big news",
    });
  });

  it("keeps inline markup inside a heading", () => {
    const result = inferTextBlock("<h2>Hello <strong>you</strong></h2>");
    expect(result).toEqual({
      kind: "title",
      level: 2,
      inner: "Hello <strong>you</strong>",
    });
  });

  it("clamps h5 to level 4 and records the original", () => {
    expect(inferTextBlock("<h5>Small</h5>")).toEqual({
      kind: "title",
      level: 4,
      inner: "Small",
      clampedFrom: 5,
    });
  });

  it("does not read two headings as a title", () => {
    expect(inferTextBlock("<h1>A</h1><h2>B</h2>")).toEqual({
      kind: "paragraph",
      html: "<h1>A</h1><h2>B</h2>",
    });
  });

  it("does not read a heading with a sibling as a title", () => {
    expect(inferTextBlock("<h1>A</h1><p>B</p>")).toEqual({
      kind: "paragraph",
      html: "<h1>A</h1><p>B</p>",
    });
  });

  it("reads ordinary rich text as a paragraph, preserving markup", () => {
    expect(
      inferTextBlock('<p><span style="font-size:10px;">Spring Sale</span></p>'),
    ).toEqual({
      kind: "paragraph",
      html: '<p><span style="font-size:10px;">Spring Sale</span></p>',
    });
  });

  it("wraps bare text in a paragraph element", () => {
    expect(inferTextBlock("Just words")).toEqual({
      kind: "paragraph",
      html: "<p>Just words</p>",
    });
  });

  it("returns an empty paragraph for missing content", () => {
    expect(inferTextBlock(undefined)).toEqual({
      kind: "paragraph",
      html: "<p></p>",
    });
  });

  it("returns an empty paragraph for whitespace-only content", () => {
    expect(inferTextBlock("   \n  ")).toEqual({
      kind: "paragraph",
      html: "<p></p>",
    });
  });

  it("tolerates attributes and whitespace on the heading tag", () => {
    expect(inferTextBlock('  <h1 style="margin:0">Title</h1>  ')).toEqual({
      kind: "title",
      level: 1,
      inner: "Title",
    });
  });

  it("omits clampedFrom entirely when the level is not clamped", () => {
    expect("clampedFrom" in inferTextBlock("<h1>Title</h1>")).toBe(false);
  });

  it("includes clampedFrom and clamps h6 to level 4", () => {
    expect(inferTextBlock("<h6>Small</h6>")).toEqual({
      kind: "title",
      level: 4,
      inner: "Small",
      clampedFrom: 6,
    });
  });
});

describe("stripTags", () => {
  it("returns the visible text of a button label", () => {
    expect(stripTags("<p>Buy <strong>now</strong></p>")).toBe("Buy now");
  });

  it("collapses whitespace", () => {
    expect(stripTags("<p>Buy\n   now</p>")).toBe("Buy now");
  });

  it("decodes the entities Topol emits", () => {
    expect(stripTags("<p>Ben &amp; Jerry&#39;s &lt;3 &nbsp;you</p>")).toBe(
      "Ben & Jerry's <3 you",
    );
  });

  it("returns an empty string for missing input", () => {
    expect(stripTags(undefined)).toBe("");
  });

  it("returns an empty string for empty input", () => {
    expect(stripTags("")).toBe("");
  });

  it("leaves an unterminated tag literally in the output", () => {
    // `/<[^>]*>/g` can never complete a match without a closing `>`, so a
    // dangling `<b` at the end of the string is left untouched. The linear
    // scan must reproduce that exactly: it emits the remainder verbatim
    // once it hits a tag that never closes.
    expect(stripTags("<p>a<b")).toBe("a<b");
  });

  it("resolves a run of unclosed tags in linear time", () => {
    // Adversarial input for the pre-fix `/<[^>]*>/g`: many `<` starts and no
    // `>` anywhere, so `[^>]*` backtracks at every one of them. At 80 KB the
    // old regex took over nine seconds (measured); this asserts the fixed
    // scan resolves in well under a second. Nothing here is a complete tag,
    // so the whole input passes through unchanged (no whitespace or
    // entities to collapse either).
    const input = "<".repeat(80_000);
    const start = performance.now();
    const result = stripTags(input);
    const elapsed = performance.now() - start;
    expect(result).toBe(input);
    expect(elapsed).toBeLessThan(500);
  });
});
