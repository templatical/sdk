// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import DOMPurify from "dompurify";
import {
  HTML_URL_ATTRIBUTES,
  HTML_FORBIDDEN_ATTRIBUTES,
  SAFE_LINK_SCHEMES,
  isSafeUrlAttribute,
} from "@templatical/types";
import { sanitizeHtml, sanitizeSvg } from "../src/utils/sanitizeHtml";

describe("sanitizeHtml", () => {
  it("agrees with the shared attribute policy at the browser insertion boundary", () => {
    for (const attribute of [
      ...HTML_URL_ATTRIBUTES,
      ...HTML_FORBIDDEN_ATTRIBUTES,
    ])
      for (const value of [
        "",
        "#top",
        "/relative/path",
        "{{url}}",
        ...SAFE_LINK_SCHEMES.map((scheme) => `${scheme}:example`),
        "data:image/png;base64,AAAA",
        "data:text/html,x",
        "javascript:alert(1)",
        "java\tscript:alert(1)",
        "file:///tmp/x",
      ]) {
        const tag = attribute === "src" ? "img" : "a";
        const clean = sanitizeHtml(`<${tag} ${attribute}="${value}">`);
        const container = document.createElement("div");
        container.innerHTML = clean;
        expect(
          container.firstElementChild?.hasAttribute(attribute),
          `${attribute}=${value}`,
        ).toBe(isSafeUrlAttribute(attribute, value));
      }
  });

  it("removes the noscript comment mutation payload", () => {
    const payload =
      "<noscript><!--</noscript><img src=x onerror=window.fire(1)>--></noscript>";
    expect(sanitizeHtml(payload)).toBe("");
  });

  it("neutralizes SVG animation that rewrites an anchor href", () => {
    const payload =
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"></animate></a></svg>';
    expect(sanitizeHtml(payload)).not.toContain("<animate");
  });

  it("keeps authored rich text and merge-tag markup byte-exact", () => {
    const html =
      '<p class="copy" style="color: #123456"><span class="merge-tag" data-merge-tag="FIRST_NAME" contenteditable="false">{{FIRST_NAME}}</span> <a href="https://example.com" target="_blank" rel="noopener noreferrer" style="color: red">link</a></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("drops contenteditable values other than exactly false", () => {
    expect(sanitizeHtml('<span contenteditable="true">x</span>')).toBe(
      "<span>x</span>",
    );
    expect(sanitizeHtml('<span contenteditable=" false ">x</span>')).toBe(
      "<span>x</span>",
    );
  });

  it("keeps email table markup byte-exact", () => {
    const html =
      '<table width="600" align="center" bgcolor="#ffffff" cellpadding="4"><tbody><tr><td align="left">Cell</td></tr></tbody></table>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows image data in src but removes it from href", () => {
    expect(sanitizeHtml('<img src="data:image/png;base64,AA">')).toBe(
      '<img src="data:image/png;base64,AA">',
    );
    expect(sanitizeHtml('<a href="data:image/png;base64,AA">x</a>')).toBe(
      "<a>x</a>",
    );
  });

  it("checks each URL-bearing attribute against the shared link scheme policy", () => {
    const html =
      '<a href="javascript:fire()" ping="javascript:fire()" xlink:href="javascript:fire()">x</a><div action="javascript:fire()" formaction="javascript:fire()" background="javascript:fire()" poster="javascript:fire()">y</div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("javascript:");
    expect(result).toContain(">x</a>");
    expect(result).toContain(">y</div>");
  });

  it("removes ping, formaction, and action even with safe URL schemes", () => {
    const result = sanitizeHtml(
      '<a href="https://example.com" ping="https://track.example">Link</a><button formaction="https://submit.example">Go</button><div action="https://submit.example">Text</div>',
    );
    expect(result).toBe(
      '<a href="https://example.com">Link</a><button>Go</button><div>Text</div>',
    );
  });

  it("keeps ordinary inline SVG used by custom block templates", () => {
    expect(
      sanitizeHtml(
        '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"></path></svg>',
      ),
    ).toBe('<svg viewBox="0 0 10 10"><path d="M0 0L10 10"></path></svg>');
  });

  it("escapes HTML when DOMPurify has no DOM support", () => {
    const supported = DOMPurify.isSupported;
    DOMPurify.isSupported = false;
    try {
      expect(sanitizeHtml('<img src="x" onerror="fire()"> & "')).toBe(
        "&lt;img src=&quot;x&quot; onerror=&quot;fire()&quot;&gt; &amp; &quot;",
      );
    } finally {
      DOMPurify.isSupported = supported;
    }
  });
  it("removes inline event handler attributes from arbitrary tags", () => {
    const result = sanitizeHtml('<img src="x.png" onerror="window.__pwn = 1">');
    expect(result).not.toContain("onerror");
    expect(result).toContain('src="x.png"');
  });

  it("strips <script> elements entirely", () => {
    const result = sanitizeHtml(
      "<p>Hello</p><script>window.__pwn = 1</script><p>World</p>",
    );
    expect(result).not.toContain("<script");
    expect(result).not.toContain("__pwn");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("strips <style> and <iframe>", () => {
    // The iframe src is inert; the assertion checks removal by tag.
    const result = sanitizeHtml(
      '<style>body{display:none}</style><iframe src="about:blank"></iframe><p>ok</p>',
    );
    expect(result).not.toContain("<style");
    expect(result).not.toContain("<iframe");
    expect(result).toContain("<p>ok</p>");
  });

  it("drops the contents of forbidden elements as the previous scrubber did", () => {
    expect(
      sanitizeHtml("<p>keep</p><form><p>discard</p></form><p>done</p>"),
    ).toBe("<p>keep</p><p>done</p>");
    expect(sanitizeHtml("<style>body{display:none}</style><p>ok</p>")).toBe(
      "<p>ok</p>",
    );
  });

  it("removes href with javascript: scheme", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
    expect(result).toContain("click");
  });

  it("removes href with vbscript: scheme", () => {
    const result = sanitizeHtml('<a href="vbscript:msgbox(1)">click</a>');
    expect(result).not.toContain("vbscript:");
  });

  it("keeps safe http/https/mailto/tel hrefs intact", () => {
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain(
      'href="https://example.com"',
    );
    expect(sanitizeHtml('<a href="mailto:x@y.com">x</a>')).toContain(
      'href="mailto:x@y.com"',
    );
    expect(sanitizeHtml('<a href="tel:+1234">x</a>')).toContain(
      'href="tel:+1234"',
    );
  });

  it("keeps anchor (#) hrefs intact", () => {
    expect(sanitizeHtml('<a href="#section">x</a>')).toContain(
      'href="#section"',
    );
  });

  it("removes src with javascript: scheme", () => {
    const result = sanitizeHtml('<img src="javascript:alert(1)">');
    expect(result).not.toContain("javascript:");
  });

  it("removes non-image data: src", () => {
    const result = sanitizeHtml(
      '<img src="data:text/html,<script>alert(1)</script>">',
    );
    expect(result).not.toContain("data:text/html");
  });

  it("keeps data:image/* src intact", () => {
    const result = sanitizeHtml(
      '<img src="data:image/png;base64,iVBORw0KGgo=">',
    );
    expect(result).toContain("data:image/png;base64,iVBORw0KGgo=");
  });

  it("rejects case-bypassed JAVASCRIPT: scheme", () => {
    const result = sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>');
    expect(result).not.toMatch(/JaVaScRiPt/i);
  });

  it("removes srcdoc attribute (defensive iframe-strip backup)", () => {
    // <iframe> itself is stripped, but defensive: ensure srcdoc on any
    // future allowed tag doesn't survive.
    const result = sanitizeHtml('<p srcdoc="<script>alert(1)</script>">x</p>');
    expect(result).not.toContain("srcdoc");
  });

  it("preserves rich-text content the editor itself produces", () => {
    const editorOutput =
      '<p><strong>bold</strong> <em>italic</em> <a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a></p>';
    const result = sanitizeHtml(editorOutput);
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("returns empty string unchanged", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("just text")).toBe("just text");
  });

  it("strips event handlers across nested elements", () => {
    const result = sanitizeHtml(
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
      [
        "leading control char U+0001",
        String.fromCharCode(1) + "javascript:alert(1)",
      ],
      ["tabs sprinkled through scheme", "\tj\na\rv\ta\nscript:alert(1)"],
    ];

    for (const [label, payload] of hrefVariants) {
      it(`removes an href that resolves to javascript: via ${label}`, () => {
        const result = sanitizeHtml(`<a href="${payload}">click</a>`);
        expect(result).not.toMatch(/href=/i);
        expect(result).toContain("click");
      });
    }

    it("removes a src that resolves to javascript: via embedded tab", () => {
      const result = sanitizeHtml('<img src="java\tscript:alert(1)">');
      expect(result).not.toMatch(/\bsrc=/i);
    });

    it("still keeps a benign https href that has a leading space", () => {
      const result = sanitizeHtml('<a href=" https://example.com">x</a>');
      expect(result).toContain("https://example.com");
    });
  });
});

describe("sanitizeSvg", () => {
  it("keeps a normal icon", () => {
    const html = '<svg viewBox="0 0 20 20"><path d="M0 0L20 20"></path></svg>';
    expect(sanitizeSvg(html)).toBe(html);
  });

  it("drops scripts, event handlers, and foreignObject HTML", () => {
    const html =
      '<svg onload="fire()"><path d="M0 0"/><script>fire()</script><foreignObject><p>bad</p></foreignObject></svg>';
    const result = sanitizeSvg(html);
    expect(result).toContain('<path d="M0 0"');
    expect(result).not.toMatch(/onload|script|foreignObject|<p>/i);
  });
});
