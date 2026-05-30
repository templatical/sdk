// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { sanitizeRichTextHtml } from "../src/utils/sanitizeRichTextHtml";

describe("sanitizeRichTextHtml", () => {
  it("removes inline event handler attributes from arbitrary tags", () => {
    const result = sanitizeRichTextHtml(
      '<img src="x.png" onerror="window.__pwn = 1">',
    );
    expect(result).not.toContain("onerror");
    expect(result).toContain('src="x.png"');
  });

  it("strips <script> elements entirely", () => {
    const result = sanitizeRichTextHtml(
      "<p>Hello</p><script>window.__pwn = 1</script><p>World</p>",
    );
    expect(result).not.toContain("<script");
    expect(result).not.toContain("__pwn");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("strips <style> and <iframe>", () => {
    const result = sanitizeRichTextHtml(
      "<style>body{display:none}</style><iframe src=\"https://evil.com\"></iframe><p>ok</p>",
    );
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<iframe");
    expect(result).toContain("<p>ok</p>");
  });

  it("removes href with javascript: scheme", () => {
    const result = sanitizeRichTextHtml(
      '<a href="javascript:alert(1)">click</a>',
    );
    expect(result).not.toContain("javascript:");
    expect(result).toContain("click");
  });

  it("removes href with vbscript: scheme", () => {
    const result = sanitizeRichTextHtml(
      '<a href="vbscript:msgbox(1)">click</a>',
    );
    expect(result).not.toContain("vbscript:");
  });

  it("keeps safe http/https/mailto/tel hrefs intact", () => {
    expect(sanitizeRichTextHtml('<a href="https://example.com">x</a>')).toContain(
      'href="https://example.com"',
    );
    expect(sanitizeRichTextHtml('<a href="mailto:x@y.com">x</a>')).toContain(
      'href="mailto:x@y.com"',
    );
    expect(sanitizeRichTextHtml('<a href="tel:+1234">x</a>')).toContain(
      'href="tel:+1234"',
    );
  });

  it("keeps anchor (#) hrefs intact", () => {
    expect(sanitizeRichTextHtml('<a href="#section">x</a>')).toContain(
      'href="#section"',
    );
  });

  it("removes src with javascript: scheme", () => {
    const result = sanitizeRichTextHtml('<img src="javascript:alert(1)">');
    expect(result).not.toContain("javascript:");
  });

  it("removes non-image data: src", () => {
    const result = sanitizeRichTextHtml(
      '<img src="data:text/html,<script>alert(1)</script>">',
    );
    expect(result).not.toContain("data:text/html");
  });

  it("keeps data:image/* src intact", () => {
    const result = sanitizeRichTextHtml(
      '<img src="data:image/png;base64,iVBORw0KGgo=">',
    );
    expect(result).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("rejects case-bypassed JAVASCRIPT: scheme", () => {
    const result = sanitizeRichTextHtml('<a href="JaVaScRiPt:alert(1)">x</a>');
    expect(result).not.toMatch(/JaVaScRiPt/i);
  });

  it("removes srcdoc attribute (defensive iframe-strip backup)", () => {
    // <iframe> itself is stripped, but defensive: ensure srcdoc on any
    // future allowed tag doesn't survive.
    const result = sanitizeRichTextHtml(
      '<p srcdoc="<script>alert(1)</script>">x</p>',
    );
    expect(result).not.toContain("srcdoc");
  });

  it("preserves rich-text content the editor itself produces", () => {
    const editorOutput =
      '<p><strong>bold</strong> <em>italic</em> <a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a></p>';
    const result = sanitizeRichTextHtml(editorOutput);
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("returns empty string unchanged", () => {
    expect(sanitizeRichTextHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeRichTextHtml("just text")).toBe("just text");
  });

  it("strips event handlers across nested elements", () => {
    const result = sanitizeRichTextHtml(
      '<div><span onclick="x"><b onmouseover="y">deep</b></span></div>',
    );
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onmouseover");
    expect(result).toContain("deep");
  });

  // Regression: the scheme check ran on a value that was only `.trim()`-ed,
  // but the browser URL parser also strips ASCII tab/LF/CR from *anywhere*
  // in the value and leading C0 control chars. So "java\tscript:..." and
  // "\x01javascript:..." matched no scheme (treated as safe) yet resolved to
  // a live javascript: URL once rendered. The sanitizer must normalize the
  // same way before matching.
  describe("control-character scheme obfuscation (XSS bypass)", () => {
    const hrefVariants: Array<[string, string]> = [
      ["embedded tab", "java\tscript:alert(1)"],
      ["embedded newline", "java\nscript:alert(1)"],
      ["embedded carriage return", "java\rscript:alert(1)"],
      ["leading control char U+0001", String.fromCharCode(1) + "javascript:alert(1)"],
      ["tabs sprinkled through scheme", "\tj\na\rv\ta\nscript:alert(1)"],
    ];

    for (const [label, payload] of hrefVariants) {
      it(`removes an href that resolves to javascript: via ${label}`, () => {
        const result = sanitizeRichTextHtml(`<a href="${payload}">click</a>`);
        expect(result).not.toMatch(/href=/i);
        expect(result).toContain("click");
      });
    }

    it("removes a src that resolves to javascript: via embedded tab", () => {
      const result = sanitizeRichTextHtml('<img src="java\tscript:alert(1)">');
      expect(result).not.toMatch(/\bsrc=/i);
    });

    it("still keeps a benign https href that has a leading space", () => {
      const result = sanitizeRichTextHtml(
        '<a href=" https://example.com">x</a>',
      );
      expect(result).toContain("https://example.com");
    });
  });
});
