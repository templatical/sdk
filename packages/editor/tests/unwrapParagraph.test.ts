import { describe, expect, it } from "vitest";
import { unwrapParagraph } from "../src/utils/unwrapParagraph";

describe("unwrapParagraph", () => {
  describe("unwraps single outer <p>", () => {
    it("strips bare <p>", () => {
      expect(unwrapParagraph("<p>Hello</p>")).toBe("Hello");
    });

    it("strips <p> with attributes", () => {
      expect(unwrapParagraph('<p style="text-align: center">Hello</p>')).toBe(
        "Hello",
      );
      expect(unwrapParagraph('<p class="title">Hello</p>')).toBe("Hello");
      expect(unwrapParagraph('<p data-foo="bar" class="x">Hello</p>')).toBe(
        "Hello",
      );
    });

    it("tolerates whitespace around the wrapper", () => {
      expect(unwrapParagraph("  <p>Hello</p>  ")).toBe("Hello");
      expect(unwrapParagraph("\n<p>Hello</p>\n")).toBe("Hello");
    });

    it("preserves whitespace inside the wrapper", () => {
      expect(unwrapParagraph("<p>  spaced  </p>")).toBe("  spaced  ");
    });

    it("returns empty string for empty <p></p>", () => {
      expect(unwrapParagraph("<p></p>")).toBe("");
    });

    it("preserves inline children", () => {
      expect(unwrapParagraph("<p>Hello <strong>bold</strong> world</p>")).toBe(
        "Hello <strong>bold</strong> world",
      );
      expect(
        unwrapParagraph('<p>foo <a href="#">link</a> <em>italic</em></p>'),
      ).toBe('foo <a href="#">link</a> <em>italic</em>');
    });

    it("preserves newlines inside the wrapper", () => {
      expect(unwrapParagraph("<p>line1\nline2</p>")).toBe("line1\nline2");
    });
  });

  describe("does NOT unwrap", () => {
    it("multiple top-level <p> elements", () => {
      const html = "<p>First</p><p>Second</p>";
      expect(unwrapParagraph(html)).toBe(html);
    });

    it("three top-level <p> elements", () => {
      const html = "<p>a</p><p>b</p><p>c</p>";
      expect(unwrapParagraph(html)).toBe(html);
    });

    it("multiple <p> with whitespace between them", () => {
      const html = "<p>First</p>\n  <p>Second</p>";
      expect(unwrapParagraph(html)).toBe(html);
    });

    it("content with no <p> wrapper", () => {
      expect(unwrapParagraph("Hello world")).toBe("Hello world");
      expect(unwrapParagraph("<h1>Direct heading</h1>")).toBe(
        "<h1>Direct heading</h1>",
      );
      expect(unwrapParagraph("<span>inline</span>")).toBe(
        "<span>inline</span>",
      );
    });

    it("empty string", () => {
      expect(unwrapParagraph("")).toBe("");
    });

    it("uppercase <P> (regex is case-sensitive — TipTap emits lowercase)", () => {
      const html = "<P>Hello</P>";
      expect(unwrapParagraph(html)).toBe(html);
    });

    it("<p> followed by trailing non-whitespace content", () => {
      const html = "<p>Hello</p>trailing";
      expect(unwrapParagraph(html)).toBe(html);
    });

    it("content preceded by non-whitespace before <p>", () => {
      const html = "leading<p>Hello</p>";
      expect(unwrapParagraph(html)).toBe(html);
    });
  });

  it("matches the renderer's unwrap rule for shared inputs", () => {
    // Sanity: same inputs that the renderer's unwrapParagraph handles must
    // produce the same output here. If these diverge, canvas and exported
    // HTML will disagree about title structure (the bug from issue #69).
    const cases: Array<[string, string]> = [
      ["<p>x</p>", "x"],
      ["<p>a</p><p>b</p>", "<p>a</p><p>b</p>"],
      ["<p>Hello <em>world</em></p>", "Hello <em>world</em>"],
      ["", ""],
    ];
    for (const [input, expected] of cases) {
      expect(unwrapParagraph(input)).toBe(expected);
    }
  });
});
