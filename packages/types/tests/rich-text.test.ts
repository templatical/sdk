import { describe, expect, it } from "vitest";
import { fillEmptyParagraphs, isBlankRichText } from "../src";

describe("isBlankRichText", () => {
  it("is true for cleared text, as TipTap stores it", () => {
    expect(isBlankRichText("<p></p>")).toBe(true);
    expect(isBlankRichText('<p style="text-align: left;"></p>')).toBe(true);
    expect(isBlankRichText("<p></p><p></p>")).toBe(true);
    expect(isBlankRichText("  <p> </p>\n")).toBe(true);
    expect(isBlankRichText("")).toBe(true);
  });

  it("is false once anything but paragraph tags is present", () => {
    expect(isBlankRichText("<p>Hi</p>")).toBe(false);
    expect(isBlankRichText("<p></p><p>Hi</p>")).toBe(false);
    expect(isBlankRichText("<p><br></p>")).toBe(false);
    expect(isBlankRichText("<ul><li><p></p></li></ul>")).toBe(false);
    expect(
      isBlankRichText('<p><span data-merge-tag="{{name}}">Name</span></p>'),
    ).toBe(false);
  });

  it("stays linear on an unclosed run of paragraph opens", () => {
    const hostile = "<p".repeat(50_000);
    const started = performance.now();
    expect(isBlankRichText(hostile)).toBe(false);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("fillEmptyParagraphs", () => {
  it("fills a blank line between paragraphs", () => {
    expect(fillEmptyParagraphs("<p>First</p><p></p><p>Second</p>")).toBe(
      "<p>First</p><p>&nbsp;</p><p>Second</p>",
    );
  });

  it("keeps the empty paragraph's attributes", () => {
    expect(
      fillEmptyParagraphs(
        '<p style="text-align: left;">A</p><p style="text-align: left;"></p><p style="text-align: left;">B</p>',
      ),
    ).toBe(
      '<p style="text-align: left;">A</p><p style="text-align: left;">&nbsp;</p><p style="text-align: left;">B</p>',
    );
  });

  it("fills every blank line in a run, and leading and trailing ones", () => {
    expect(fillEmptyParagraphs("<p></p><p>A</p><p></p><p></p><p>B</p><p></p>")).toBe(
      "<p>&nbsp;</p><p>A</p><p>&nbsp;</p><p>&nbsp;</p><p>B</p><p>&nbsp;</p>",
    );
  });

  it("fills an empty paragraph inside a list item", () => {
    expect(
      fillEmptyParagraphs("<p>A</p><ul><li><p></p></li><li><p>B</p></li></ul>"),
    ).toBe("<p>A</p><ul><li><p>&nbsp;</p></li><li><p>B</p></li></ul>");
  });

  it("treats a whitespace-only paragraph as empty", () => {
    expect(fillEmptyParagraphs("<p>A</p><p> \n</p>")).toBe(
      "<p>A</p><p>&nbsp;</p>",
    );
  });

  it("returns blank text unchanged, since the renderer drops it", () => {
    expect(fillEmptyParagraphs("<p></p>")).toBe("<p></p>");
    expect(fillEmptyParagraphs("<p></p><p></p>")).toBe("<p></p><p></p>");
    expect(fillEmptyParagraphs("")).toBe("");
  });

  it("leaves paragraphs with content, hard breaks and other tags alone", () => {
    const html = "<p>A</p><p><br></p><pre></pre><p><strong></strong></p>";
    expect(fillEmptyParagraphs(html)).toBe(html);
  });

  it("is idempotent", () => {
    const once = fillEmptyParagraphs("<p>A</p><p></p><p>B</p>");
    expect(fillEmptyParagraphs(once)).toBe(once);
  });
});
