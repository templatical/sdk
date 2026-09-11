import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import {
  convertElement,
  convertHtmlFallback,
  convertInlineRun,
  isButtonCell,
  isInlineContent,
  isProseAnchor,
  isSpacerCell,
  looksLikeButton,
} from "../block-mapper";
import type { Element } from "domhandler";
import type { Cheerio } from "cheerio";

function firstEl(html: string, selector: string) {
  const $ = load(html);
  const $el = $(selector).first() as unknown as Cheerio<Element>;
  return { $, $el };
}

/** The child nodes of a `<td>`, text nodes and comments included. */
function cellNodes(inner: string, cellAttrs = "") {
  const $ = load(`<table><tr><td ${cellAttrs}>${inner}</td></tr></table>`);
  const $cell = $("td").first() as unknown as Cheerio<Element>;
  return { $, $cell, nodes: $cell.contents().toArray() };
}

describe("convertElement — headings", () => {
  it("converts h1 to title block with level 1", () => {
    const { $, $el } = firstEl(
      '<h1 style="color:#ff0000;text-align:center;font-family:Arial">Hello</h1>',
      "h1",
    );
    const r = convertElement($el, $);
    expect(r).not.toBeNull();
    expect(r!.entry).toEqual({
      sourceTag: "h1",
      templaticalBlockType: "title",
      status: "converted",
    });
    if (r!.block.type !== "title") throw new Error("expected title block");
    expect(r!.block.level).toBe(1);
    expect(r!.block.color).toBe("#ff0000");
    expect(r!.block.textAlign).toBe("center");
    expect(r!.block.fontFamily).toBe("Arial");
    expect(r!.block.content).toContain("Hello");
  });

  it("clamps h5/h6 to level 4", () => {
    const { $, $el } = firstEl("<h6>Hi</h6>", "h6");
    const r = convertElement($el, $)!;
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.level).toBe(4);
  });

  it("emits empty paragraph wrapper for empty heading", () => {
    const { $, $el } = firstEl("<h2></h2>", "h2");
    const r = convertElement($el, $)!;
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.content).toBe("<p></p>");
  });
});

describe("convertElement — paragraphs", () => {
  it("converts p to paragraph block", () => {
    const { $, $el } = firstEl("<p>hello world</p>", "p");
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("paragraph");
    expect(r.entry.status).toBe("converted");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("hello world");
  });

  it("wraps bare text in <p>", () => {
    const { $, $el } = firstEl("<div>just text</div>", "div");
    const r = convertElement($el, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<p>");
    expect(r.block.content).toContain("just text");
  });

  it("returns null for empty text container", () => {
    const { $, $el } = firstEl("<p>   </p>", "p");
    expect(convertElement($el, $)).toBeNull();
  });

  it("applies inline color and font-size as inner span", () => {
    const { $, $el } = firstEl(
      '<p style="color:#0000ff;font-size:18px">hi</p>',
      "p",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("color: #0000ff");
    expect(r.block.content).toContain("font-size: 18px");
  });

  it("applies text-align on the <p>", () => {
    const { $, $el } = firstEl('<p style="text-align:center">hi</p>', "p");
    const r = convertElement($el, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("text-align: center");
  });

  it("applies container text-align to an inner <p> that has a non-style attribute", () => {
    // Real email HTML routinely carries class/id/dir on the inner <p>. The
    // alignment must still be applied even though the <p> has no leading
    // style attribute for the narrow `<p style="...">`/`<p>` matchers to hit.
    const { $, $el } = firstEl(
      '<div style="text-align:center"><p class="lead">Centered</p></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("Centered");
    expect(r.block.content).toContain("text-align: center");
    expect(r.block.content).toContain('class="lead"');
  });

  it("merges text-align into an inner <p> that already has a style attribute", () => {
    const { $, $el } = firstEl(
      '<div style="text-align:right"><p style="color:#123456">Right</p></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("text-align: right");
    expect(r.block.content).toContain("color:#123456");
  });
});

describe("convertElement — images", () => {
  it("converts img with src/alt/width", () => {
    const { $, $el } = firstEl(
      '<img src="https://x/img.jpg" alt="hero" width="320" />',
      "img",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error("expected image block");
    expect(r.block.src).toBe("https://x/img.jpg");
    expect(r.block.alt).toBe("hero");
    expect(r.block.width).toBe(320);
  });

  it("preserves empty alt for decorative images", () => {
    const { $, $el } = firstEl(
      '<img src="https://x/decor.png" alt="" />',
      "img",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error("expected image block");
    expect(r.block.alt).toBe("");
  });

  it("falls back to width style or 600 default", () => {
    const r1 = (() => {
      const { $, $el } = firstEl('<img src="x" style="width:480px" />', "img");
      return convertElement($el, $)!;
    })();
    const r2 = (() => {
      const { $, $el } = firstEl('<img src="x" />', "img");
      return convertElement($el, $)!;
    })();
    if (r1.block.type !== "image") throw new Error();
    if (r2.block.type !== "image") throw new Error();
    expect(r1.block.width).toBe(480);
    expect(r2.block.width).toBe(600);
  });

  // A source template that pins a height is expressing a fixed layout box;
  // dropping it silently reflows the import. There is no default, because
  // absent means "derive it from the width" all the way down to the renderer.
  it("carries an explicit height from the attribute or the style", () => {
    const fromAttr = (() => {
      const { $, $el } = firstEl(
        '<img src="x" width="320" height="180" />',
        "img",
      );
      return convertElement($el, $)!;
    })();
    const fromStyle = (() => {
      const { $, $el } = firstEl(
        '<img src="x" style="width:320px;height:180px" />',
        "img",
      );
      return convertElement($el, $)!;
    })();
    if (fromAttr.block.type !== "image") throw new Error();
    if (fromStyle.block.type !== "image") throw new Error();
    expect(fromAttr.block.height).toBe(180);
    expect(fromStyle.block.height).toBe(180);
  });

  it("leaves the height unset when the source has none, or says auto", () => {
    const none = (() => {
      const { $, $el } = firstEl('<img src="x" width="320" />', "img");
      return convertElement($el, $)!;
    })();
    // `height="auto"` and `height:auto` are the common way a responsive email
    // says "no fixed height" — parsing them as 0 would collapse the image.
    const autoAttr = (() => {
      const { $, $el } = firstEl('<img src="x" height="auto" />', "img");
      return convertElement($el, $)!;
    })();
    const autoStyle = (() => {
      const { $, $el } = firstEl('<img src="x" style="height:auto" />', "img");
      return convertElement($el, $)!;
    })();
    if (none.block.type !== "image") throw new Error();
    if (autoAttr.block.type !== "image") throw new Error();
    if (autoStyle.block.type !== "image") throw new Error();
    expect(none.block.height).toBeUndefined();
    expect(autoAttr.block.height).toBeUndefined();
    expect(autoStyle.block.height).toBeUndefined();
  });

  // Rounded avatars are common in imported templates, and there the radius is
  // the whole shape: dropping it turns a circle back into a square.
  it("carries a px corner radius from the style", () => {
    const { $, $el } = firstEl(
      '<img src="x" width="120" style="border-radius:60px" />',
      "img",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error();
    expect(r.block.borderRadius).toBe(60);
  });

  function imageFrom(html: string) {
    const { $, $el } = firstEl(html, "img");
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error("expected an image block");
    return r.block;
  }

  it("leaves the radius unset for a square image", () => {
    expect(
      imageFrom('<img src="x" width="120" />').borderRadius,
    ).toBeUndefined();
  });

  // `border-radius:50%` is the idiomatic way to write a circular avatar, and
  // the whole point of importing a radius is that the circle survives. It
  // resolves against the width the template stated, so a 120px square lands on
  // 60 — the same block a hand-authored `60px` produces.
  it("resolves a percentage radius against the stated width", () => {
    expect(
      imageFrom('<img src="x" width="120" style="border-radius:50%" />')
        .borderRadius,
    ).toBe(60);
  });

  // The shorter side, so a wide image becomes a pill rather than acquiring a
  // radius larger than its own height.
  it("resolves a percentage against the shorter side when both are known", () => {
    expect(
      imageFrom(
        '<img src="x" width="600" height="200" style="border-radius:50%" />',
      ).borderRadius,
    ).toBe(100);
  });

  // 600 is `convertImage`'s fallback, not something the template said. Resolving
  // against it would invent a 300px radius out of nothing.
  it("drops a percentage radius when no width was stated", () => {
    expect(
      imageFrom('<img src="x" style="border-radius:50%" />').borderRadius,
    ).toBeUndefined();
  });

  // Invalid CSS, and the editor's own toolbar refuses it — so it must not
  // arrive through the importer either.
  it("drops a negative radius", () => {
    expect(
      imageFrom('<img src="x" width="120" style="border-radius:-5px" />')
        .borderRadius,
    ).toBeUndefined();
    expect(
      imageFrom('<img src="x" width="120" style="border-radius:-50%" />')
        .borderRadius,
    ).toBeUndefined();
  });
});

describe("convertElement — anchors", () => {
  it("converts styled anchor to button", () => {
    const { $, $el } = firstEl(
      '<a href="https://example.com" target="_blank" style="background-color:#ff0000;padding:10px 20px;border-radius:6px;color:#ffffff">Click</a>',
      "a",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("button");
    if (r.block.type !== "button") throw new Error("expected button block");
    expect(r.block.text).toBe("Click");
    expect(r.block.url).toBe("https://example.com");
    expect(r.block.openInNewTab).toBe(true);
    expect(r.block.backgroundColor).toBe("#ff0000");
    expect(r.block.textColor).toBe("#ffffff");
    expect(r.block.borderRadius).toBe(6);
    expect(r.block.buttonPadding).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });
  });

  const BUTTON_STYLE =
    "background-color:#ff0000;padding:10px 20px;border-radius:6px;color:#ffffff";

  function buttonInCell(cellAttrs: string) {
    const { $, $el } = firstEl(
      `<table><tr><td ${cellAttrs}><a href="https://example.com" style="${BUTTON_STYLE}">Click</a></td></tr></table>`,
      "a",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "button") throw new Error("expected button block");
    return r.block;
  }

  it("reads button alignment from the wrapping cell's text-align", () => {
    expect(buttonInCell('style="text-align:left"').align).toBe("left");
  });

  it("reads button alignment from the wrapping cell's legacy align attribute", () => {
    expect(buttonInCell('align="right"').align).toBe("right");
  });

  it("prefers the cell's text-align over its align attribute", () => {
    // CSS wins in every modern client, so the attribute is the fallback.
    expect(buttonInCell('align="right" style="text-align:left"').align).toBe(
      "left",
    );
  });

  it("centers a button whose cell says nothing about alignment", () => {
    expect(buttonInCell("").align).toBe("center");
  });

  it("centers a button with no wrapping cell at all", () => {
    const { $, $el } = firstEl(
      `<a href="https://example.com" style="${BUTTON_STYLE}">Click</a>`,
      "a",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "button") throw new Error("expected button block");
    expect(r.block.align).toBe("center");
  });

  it("ignores the anchor's own text-align", () => {
    // The anchor is sized to its content, so its text-align says nothing
    // about where the button sits — only the cell does.
    const { $, $el } = firstEl(
      `<table><tr><td><a href="https://example.com" style="${BUTTON_STYLE};text-align:right">Click</a></td></tr></table>`,
      "a",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "button") throw new Error("expected button block");
    expect(r.block.align).toBe("center");
  });

  it("plain anchor falls back to paragraph (approximated)", () => {
    const { $, $el } = firstEl('<a href="https://x.com">link</a>', "a");
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("paragraph");
    expect(r.entry.status).toBe("approximated");
  });

  const LINKED_SRC = "https://cdn.test/autumn-hero.jpg";
  const LINKED_ALT = "Autumn sale banner";
  const LINKED_HREF = "https://shop.test/autumn";

  it("maps an image-only anchor to an image with linkUrl", () => {
    const { $, $el } = firstEl(
      `<a href="${LINKED_HREF}"><img src="${LINKED_SRC}" alt="${LINKED_ALT}"></a>`,
      "a",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("a");
    expect(r.entry.templaticalBlockType).toBe("image");
    expect(r.entry.status).toBe("converted");
    expect("note" in r.entry).toBe(false);
    if (r.block.type !== "image") throw new Error("expected image block");
    expect(r.block.src).toBe(LINKED_SRC);
    expect(r.block.alt).toBe(LINKED_ALT);
    expect(r.block.linkUrl).toBe(LINKED_HREF);
  });

  it("maps a styled image-only anchor to an image, not a button", () => {
    // A button built from an image-only anchor is labelled by the factory
    // default and discards the image. The image case is decided first.
    const { $, $el } = firstEl(
      `<a style="background:#f00;padding:8px 16px" href="${LINKED_HREF}">` +
        `<img src="${LINKED_SRC}" alt="${LINKED_ALT}"></a>`,
      "a",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("image");
    expect(r.entry.status).toBe("converted");
    if (r.block.type !== "image") throw new Error("expected image block");
    expect(r.block.src).toBe(LINKED_SRC);
    expect(r.block.alt).toBe(LINKED_ALT);
    expect(r.block.linkUrl).toBe(LINKED_HREF);
    expect(r.block.type).not.toBe("button");
  });

  it("sets linkOpenInNewTab when the wrapping anchor targets _blank", () => {
    const { $, $el } = firstEl(
      `<a href="${LINKED_HREF}" target="_blank">` +
        `<img src="${LINKED_SRC}" alt="${LINKED_ALT}"></a>`,
      "a",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error("expected image block");
    expect(r.block.linkOpenInNewTab).toBe(true);
  });

  it("omits linkOpenInNewTab when the wrapping anchor has no _blank target", () => {
    const { $, $el } = firstEl(
      `<a href="${LINKED_HREF}"><img src="${LINKED_SRC}" alt="${LINKED_ALT}"></a>`,
      "a",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "image") throw new Error("expected image block");
    expect("linkOpenInNewTab" in r.block).toBe(false);
  });
});

describe("convertElement — divider", () => {
  it("converts hr to divider block", () => {
    const { $, $el } = firstEl(
      '<hr style="border-top: 2px dashed #cccccc" />',
      "hr",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "divider") throw new Error("expected divider block");
    expect(r.block.lineStyle).toBe("dashed");
    expect(r.block.thickness).toBe(2);
    expect(r.block.color).toBe("#cccccc");
  });

  it("parses the border shorthand (thickness/style/color) when no border-top is set", () => {
    const { $, $el } = firstEl('<hr style="border:3px solid #999999" />', "hr");
    const r = convertElement($el, $)!;
    if (r.block.type !== "divider") throw new Error("expected divider block");
    expect(r.block.thickness).toBe(3);
    expect(r.block.lineStyle).toBe("solid");
    expect(r.block.color).toBe("#999999");
  });

  it("prefers border-top over the border shorthand and maps dotted style", () => {
    const { $, $el } = firstEl(
      '<hr style="border:1px solid #000000;border-top:4px dotted #abcdef" />',
      "hr",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "divider") throw new Error("expected divider block");
    expect(r.block.thickness).toBe(4);
    expect(r.block.lineStyle).toBe("dotted");
    expect(r.block.color).toBe("#abcdef");
  });

  it("falls back to defaults when no border styles are present", () => {
    // No border-top / border → parseBorderShorthand returns its own fallback
    // (width 0, solid, #000000). thickness 0 becomes 1 via `|| 1`; the
    // shorthand's #000000 color is truthy so it wins over the #e5e7eb default.
    const { $, $el } = firstEl("<hr />", "hr");
    const r = convertElement($el, $)!;
    if (r.block.type !== "divider") throw new Error("expected divider block");
    expect(r.block.thickness).toBe(1);
    expect(r.block.lineStyle).toBe("solid");
    expect(r.block.color).toBe("#000000");
  });
});

describe("convertElement — empty text containers return null", () => {
  it("returns null for an empty <p> with no media children", () => {
    const { $, $el } = firstEl("<td><p></p></td>", "p");
    expect(convertElement($el, $)).toBeNull();
  });

  it("returns null for a whitespace-only <span>", () => {
    const { $, $el } = firstEl("<span>   </span>", "span");
    expect(convertElement($el, $)).toBeNull();
  });

  it("returns null for an empty <div> with no media children", () => {
    const { $, $el } = firstEl("<div></div>", "div");
    expect(convertElement($el, $)).toBeNull();
  });

  it("still converts an empty <span> that wraps an image", () => {
    // The null guard only fires when there is no text AND no img/a descendant.
    const { $, $el } = firstEl(
      '<span><img src="https://x/x.png" alt="" /></span>',
      "span",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("paragraph");
    expect(r.entry.status).toBe("converted");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<img");
  });
});

describe("convertElement — fallback", () => {
  it("unknown element produces html-fallback", () => {
    const { $, $el } = firstEl("<custom-tag>x</custom-tag>", "custom-tag");
    const r = convertElement($el, $)!;
    expect(r.entry.status).toBe("html-fallback");
    expect(r.entry.templaticalBlockType).toBe("html");
    if (r.block.type !== "html") throw new Error("expected html block");
    expect(r.block.content).toContain("custom-tag");
  });
});

describe("convertHtmlFallback", () => {
  it("returns html block containing element outerHTML", () => {
    const { $, $el } = firstEl("<section>raw</section>", "section");
    const block = convertHtmlFallback($el, $, "preserved");
    if (block.type !== "html") throw new Error("expected html block");
    expect(block.content).toContain("section");
    expect(block.content).toContain("raw");
    expect(block.content).toContain("preserved");
  });
});

describe("looksLikeButton", () => {
  it("matches background-color", () => {
    expect(looksLikeButton({ "background-color": "#ff0000" })).toBe(true);
  });
  it("matches padding", () => {
    expect(looksLikeButton({ padding: "10px" })).toBe(true);
  });
  it("matches border-radius", () => {
    expect(looksLikeButton({ "border-radius": "6px" })).toBe(true);
  });
  it("matches inline-block display", () => {
    expect(looksLikeButton({ display: "inline-block" })).toBe(true);
  });
  it("does not match plain text styles", () => {
    expect(looksLikeButton({ color: "#000000" })).toBe(false);
  });
});

describe("isProseAnchor", () => {
  function anchor(html: string) {
    return firstEl(`<table><tr><td>${html}</td></tr></table>`, "a").$el;
  }

  it("reads an unstyled link with text as prose", () => {
    expect(
      isProseAnchor(anchor('<a href="https://x.test/go">read on</a>')),
    ).toBe(true);
  });

  it("reads a link styled only for colour as prose", () => {
    expect(
      isProseAnchor(
        anchor('<a style="color:#2b8a3e" href="https://x.test/go">read on</a>'),
      ),
    ).toBe(true);
  });

  it("reads an in-page anchor with text as prose", () => {
    // No href at all. Folding still keeps more than the per-element path,
    // which reads the anchor's inner HTML and drops the element.
    expect(isProseAnchor(anchor('<a name="top">Back to top</a>'))).toBe(true);
  });

  it("refuses a link the source styled as a button", () => {
    // Every arm of `looksLikeButton`, so the fold cannot swallow a call to
    // action however the source declared one.
    expect(
      isProseAnchor(
        anchor('<a style="background:#ff0000" href="https://x.test">Buy</a>'),
      ),
    ).toBe(false);
    expect(
      isProseAnchor(
        anchor('<a style="padding:8px 16px" href="https://x.test">Buy</a>'),
      ),
    ).toBe(false);
    expect(
      isProseAnchor(
        anchor('<a style="border-radius:6px" href="https://x.test">Buy</a>'),
      ),
    ).toBe(false);
    expect(
      isProseAnchor(
        anchor('<a style="display:inline-block" href="https://x.test">Buy</a>'),
      ),
    ).toBe(false);
  });

  it("refuses a link carrying no text of its own", () => {
    // `convertInlineRun` emits nothing for a run with no text, so an
    // image-only link must stay a block rather than folding into one.
    expect(
      isProseAnchor(
        anchor(
          '<a href="https://x.test/go"><img src="https://x.test/p.png"></a>',
        ),
      ),
    ).toBe(false);
  });

  it("refuses a link that wraps an image plus text", () => {
    // Folding would keep the image as raw markup inside a paragraph. The
    // image is a first-class block with linkUrl; the text is a sibling.
    expect(
      isProseAnchor(
        anchor(
          '<a href="https://shop.test/autumn">' +
            '<img src="https://cdn.test/autumn-hero.jpg" alt="Autumn sale banner">' +
            "Shop now</a>",
        ),
      ),
    ).toBe(false);
  });

  it("refuses a link whose text is only whitespace", () => {
    expect(isProseAnchor(anchor('<a href="https://x.test/go">  </a>'))).toBe(
      false,
    );
  });
});

describe("isSpacerCell", () => {
  it("matches empty td with explicit height", () => {
    const { $el } = firstEl(
      '<table><tr><td height="20"></td></tr></table>',
      "td",
    );
    expect(isSpacerCell($el)).toBe(true);
  });

  it("does not match cell with text", () => {
    const { $el } = firstEl(
      '<table><tr><td height="20">hi</td></tr></table>',
      "td",
    );
    expect(isSpacerCell($el)).toBe(false);
  });

  it("does not match cell containing img", () => {
    const { $el } = firstEl(
      '<table><tr><td height="20"><img src="x" /></td></tr></table>',
      "td",
    );
    expect(isSpacerCell($el)).toBe(false);
  });

  it("does not match cell without height", () => {
    const { $el } = firstEl("<table><tr><td></td></tr></table>", "td");
    expect(isSpacerCell($el)).toBe(false);
  });
});

describe("isButtonCell", () => {
  it("matches td with single styled anchor", () => {
    const { $, $el } = firstEl(
      '<table><tr><td><a href="x" style="background:#ff0000;padding:10px">Go</a></td></tr></table>',
      "td",
    );
    const r = isButtonCell($el, $);
    expect(r.match).toBe(true);
    expect(r.anchor).toBeDefined();
  });

  it("matches td with bg+plain anchor (cell-styled button)", () => {
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#ff0000;padding:10px;border-radius:4px"><a href="x">Go</a></td></tr></table>',
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(true);
  });

  it("does not match td with multiple anchors", () => {
    const { $, $el } = firstEl(
      '<table><tr><td><a href="a">A</a><a href="b">B</a></td></tr></table>',
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not match td with plain anchor and no styling", () => {
    const { $, $el } = firstEl(
      '<table><tr><td><a href="x">link</a></td></tr></table>',
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not classify a styled cell as a button when its anchor has no href", () => {
    // Legacy email patterns wrap a styled link-like span in a <td> with
    // background/padding/radius. Without an href, treating it as a button
    // produces a clickable element with href="#", which is wrong — it
    // should fall through to the regular text-conversion path.
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#ff0000;padding:10px;border-radius:4px"><a>Go</a></td></tr></table>',
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not classify a styled cell as a button when its anchor has empty href", () => {
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#ff0000;padding:10px;border-radius:4px"><a href="">Go</a></td></tr></table>',
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("matches a styled cell whose entire text is the anchor's", () => {
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#0b7285;padding:14px">' +
        '<a href="https://events.test/claim">Claim your seat</a>' +
        "</td></tr></table>",
      "td",
    );
    const r = isButtonCell($el, $);
    expect(r.match).toBe(true);
    expect(r.anchor?.attr("href")).toBe("https://events.test/claim");
  });

  it("matches a styled cell whose text differs from the anchor's only by whitespace", () => {
    // Nested tags and source indentation add whitespace that never renders,
    // so the comparison normalises both sides.
    const { $, $el } = firstEl(
      '<table><tr><td style="padding:14px">\n  ' +
        '<a href="https://events.test/claim">Claim\n  your seat</a>\n' +
        "</td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(true);
  });

  it("does not classify a styled cell as a button when the anchor is a fragment of its prose", () => {
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#0b7285;padding:14px">' +
        'Read the <a href="https://legal.test/terms">terms</a> before you continue' +
        "</td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not classify an outer cell as a button when it wraps a nested button cell plus prose", () => {
    // `find("a")` matches at any depth, so a callout cell holding copy and a
    // nested CTA cell reaches the cell-styling arm too.
    const { $, $el } = firstEl(
      '<table><tr><td style="padding:14px">Callout copy about the offer' +
        '<table><tr><td style="padding:10px">' +
        '<a href="https://shop.test/buy">Purchase Now</a>' +
        "</td></tr></table></td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not classify a cell as a button when a self-styled anchor sits in its prose", () => {
    // The anchor-styling arm carries the same whole-cell requirement: its own
    // background says the link is a button, not that the link is the cell.
    const { $, $el } = firstEl(
      "<table><tr><td>Callout copy about the offer " +
        '<a href="https://shop.test/buy" ' +
        'style="background:#0b7285;padding:12px 20px">Purchase Now</a>' +
        "</td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("still matches an anchor carrying its own button styling in a whole-cell position", () => {
    // Negative control for the anchor-styling arm: the whole-cell requirement
    // must not stop a self-styled CTA being read as a button.
    const { $, $el } = firstEl(
      '<table><tr><td><a href="https://shop.test/buy" ' +
        'style="background:#0b7285;padding:12px 20px;border-radius:9px">Purchase Now</a>' +
        "</td></tr></table>",
      "td",
    );
    const r = isButtonCell($el, $);
    expect(r.match).toBe(true);
    expect(r.anchor?.attr("href")).toBe("https://shop.test/buy");
  });

  it("does not match a cell whose entire content is a linked image", () => {
    // `isWholeCellAnchor` compares normalised text; an `<a><img></a>` is
    // `"" === ""` and would otherwise pass. A button labelled from that
    // empty text is the factory default and the image is discarded.
    const { $, $el } = firstEl(
      "<table><tr><td>" +
        '<a href="https://shop.test/autumn">' +
        '<img src="https://cdn.test/autumn-hero.jpg" alt="Autumn sale banner">' +
        "</a></td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not match a cell whose entire content is a styled linked image", () => {
    const { $, $el } = firstEl(
      "<table><tr><td>" +
        '<a style="background:#f00;padding:8px 16px" href="https://shop.test/autumn">' +
        '<img src="https://cdn.test/autumn-hero.jpg" alt="Autumn sale banner">' +
        "</a></td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not match a styled cell wrapping a linked image", () => {
    const { $, $el } = firstEl(
      '<table><tr><td style="background:#f00;padding:8px 16px">' +
        '<a href="https://shop.test/autumn">' +
        '<img src="https://cdn.test/autumn-hero.jpg" alt="Autumn sale banner">' +
        "</a></td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });

  it("does not match a styled anchor wrapping an image plus text", () => {
    const { $, $el } = firstEl(
      "<table><tr><td>" +
        '<a style="background:#f00;padding:8px 16px" href="https://shop.test/autumn">' +
        '<img src="https://cdn.test/autumn-hero.jpg" alt="Autumn sale banner">' +
        "Shop now</a></td></tr></table>",
      "td",
    );
    expect(isButtonCell($el, $).match).toBe(false);
  });
});

describe("isInlineContent", () => {
  it("reads a bare text node as inline content", () => {
    const { nodes } = cellNodes("just text");
    expect(nodes.map(isInlineContent)).toEqual([true]);
  });

  it("reads every inline formatting tag as inline content", () => {
    const { nodes } = cellNodes(
      "<br><em>e</em><strong>s</strong><i>i</i><b>b</b><u>u</u>" +
        "<small>sm</small><sub>sb</sub><sup>sp</sup>",
    );
    expect(nodes.map((node) => (node as Element).tagName)).toEqual([
      "br",
      "em",
      "strong",
      "i",
      "b",
      "u",
      "small",
      "sub",
      "sup",
    ]);
    expect(nodes.map(isInlineContent)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("excludes <a>, which is classified by isProseAnchor instead", () => {
    // An anchor is not unconditionally inline: a styled one is a button. So
    // the cell walk asks `isProseAnchor` per anchor, and this predicate keeps
    // reading `<a>` as a block — which is also what `packagingTablesOf`
    // needs, since a cell holding a link has content that must not be
    // discarded as packaging.
    const { nodes } = cellNodes('<a href="https://x.test/go">link</a>');
    expect(nodes.map(isInlineContent)).toEqual([false]);
  });

  it("excludes block-producing and unknown elements", () => {
    const { nodes } = cellNodes(
      "<p>p</p><div>d</div><span>s</span><h2>h</h2>" +
        '<img src="https://x.test/a.jpg"><hr><table></table><marquee>m</marquee>',
    );
    expect(nodes.map(isInlineContent)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("excludes a comment node", () => {
    const { nodes } = cellNodes("<!-- *|IF:X|* -->");
    expect(nodes.map((node) => node.type)).toEqual(["comment"]);
    expect(nodes.map(isInlineContent)).toEqual([false]);
  });
});

describe("convertInlineRun", () => {
  it("builds one paragraph from a run, styled by the cell that holds it", () => {
    const { $, $cell, nodes } = cellNodes(
      "Lead <strong>copy</strong>",
      'style="padding:8px 12px;color:#ff0000;font-size:22px;text-align:right"',
    );
    const r = convertInlineRun(nodes, $cell, $);
    expect(r).not.toBeNull();
    expect(r!.entry).toEqual({
      sourceTag: "td",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
    if (r!.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    // The run's own markup survives inside the wrapping <p>; the cell's
    // colour, size and alignment are what style it.
    expect(r!.block.content).toBe(
      '<p style="text-align: right">' +
        '<span style="font-size: 22px; color: #ff0000">' +
        "Lead <strong>copy</strong>" +
        "</span></p>",
    );
    expect(r!.block.styles.padding).toEqual({
      top: 8,
      right: 12,
      bottom: 8,
      left: 12,
    });
  });

  it("keeps a line break inside the paragraph rather than beside it", () => {
    const { $, $cell, nodes } = cellNodes("Hello<br>World");
    const r = convertInlineRun(nodes, $cell, $)!;
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toBe("<p>Hello<br>World</p>");
  });

  it("reports the cell's own tag, so a <th> is not reported as a <td>", () => {
    const $ = load("<table><tr><th>Header <em>copy</em></th></tr></table>");
    const $cell = $("th").first() as unknown as Cheerio<Element>;
    const r = convertInlineRun($cell.contents().toArray(), $cell, $)!;
    expect(r.entry.sourceTag).toBe("th");
  });

  it("returns null for a run carrying no text", () => {
    const { $, $cell, nodes } = cellNodes("&nbsp;<br><br>");
    expect(convertInlineRun(nodes, $cell, $)).toBeNull();
  });
});

describe("convertElement — a container wrapping one block-level element", () => {
  it("types a heading the container wraps, rather than burying it in a paragraph", () => {
    const { $, $el } = firstEl("<div><h3>Wrapped heading</h3></div>", "div");
    const r = convertElement($el, $)!;
    expect(r.entry).toEqual({
      sourceTag: "h3",
      templaticalBlockType: "title",
      status: "converted",
    });
    if (r.block.type !== "title") throw new Error("expected title block");
    // `level: 3` is off the factory default (2), so this cannot pass on a
    // default that merely survived.
    expect(r.block.level).toBe(3);
    expect(r.block.content).toBe("<p>Wrapped heading</p>");
  });

  it("reads <center> and <main> as containers too, from the one container list", () => {
    const center = firstEl("<center><h4>Centered</h4></center>", "center");
    const rc = convertElement(center.$el, center.$)!;
    expect(rc.entry.sourceTag).toBe("h4");
    if (rc.block.type !== "title") throw new Error("expected title block");
    expect(rc.block.level).toBe(4);

    const main = firstEl("<main><h3>Main</h3></main>", "main");
    const rm = convertElement(main.$el, main.$)!;
    expect(rm.entry.sourceTag).toBe("h3");
    if (rm.block.type !== "title") throw new Error("expected title block");
    expect(rm.block.level).toBe(3);
  });

  it("carries the container's styling onto the element that takes its place", () => {
    const { $, $el } = firstEl(
      '<div style="color:#ff0000;text-align:center;font-family:Georgia, serif;padding:7px">' +
        '<h3 style="margin:0">Styled heading</h3>' +
        "</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.color).toBe("#ff0000");
    expect(r.block.textAlign).toBe("center");
    expect(r.block.fontFamily).toBe("Georgia");
    expect(r.block.styles.padding).toEqual({
      top: 7,
      right: 7,
      bottom: 7,
      left: 7,
    });
  });

  it("lets the element's own declarations win over the container's", () => {
    const { $, $el } = firstEl(
      '<div style="color:#ff0000;text-align:center">' +
        '<h3 style="color:#0000ff;text-align:right">Own styling</h3>' +
        "</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.color).toBe("#0000ff");
    expect(r.block.textAlign).toBe("right");
  });

  it("treats `inherit` as stating nothing, so the container's value survives", () => {
    // mjml@5 emits exactly this shape: every visual property on the wrapper,
    // and `inherit` on the heading. Letting `inherit` shadow the wrapper drops
    // the colour and reads the alignment off nothing.
    const { $, $el } = firstEl(
      '<div style="font-family:Arial, sans-serif;font-size:22px;text-align:center;color:#ff0000">' +
        '<h3 style="margin:0;font-size:inherit;color:inherit;line-height:inherit">Inheriting heading</h3>' +
        "</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.color).toBe("#ff0000");
    expect(r.block.textAlign).toBe("center");
    expect(r.block.fontFamily).toBe("Arial");
  });

  it("unwraps through nested containers, accumulating their styling", () => {
    const { $, $el } = firstEl(
      '<div style="color:#ff0000">' +
        '<div style="text-align:right"><h4>Deeply wrapped</h4></div>' +
        "</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("h4");
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.level).toBe(4);
    expect(r.block.content).toBe("<p>Deeply wrapped</p>");
    expect(r.block.color).toBe("#ff0000");
    expect(r.block.textAlign).toBe("right");
  });

  it("tolerates whitespace and comments around the element", () => {
    const { $, $el } = firstEl(
      "<div>\n  <!-- merge tag -->\n  <h3>Spaced heading</h3>\n</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("h3");
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.content).toBe("<p>Spaced heading</p>");
  });

  it("reads a bare &nbsp; as whitespace, as the rest of the package does", () => {
    const { $, $el } = firstEl(
      "<div>&nbsp;<h3>Padded heading</h3></div>",
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("h3");
    if (r.block.type !== "title") throw new Error("expected title block");
    expect(r.block.content).toBe("<p>Padded heading</p>");
  });

  it("skips a container wrapping an empty heading, as it skips an empty container", () => {
    const wrapped = firstEl("<div><h3></h3></div>", "div");
    expect(convertElement(wrapped.$el, wrapped.$)).toBeNull();

    const bare = firstEl("<div></div>", "div");
    expect(convertElement(bare.$el, bare.$)).toBeNull();
  });
});

describe("convertElement — a container it must not unwrap", () => {
  it("leaves two block-level children alone", () => {
    const { $, $el } = firstEl("<div><h3>Title</h3><p>Prose</p></div>", "div");
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<h3>Title</h3>");
    expect(r.block.content).toContain("<p>Prose</p>");
  });

  it("leaves lead text beside the element alone", () => {
    const { $, $el } = firstEl("<div>Lead text<h3>Title</h3></div>", "div");
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("Lead text");
    expect(r.block.content).toContain("<h3>Title</h3>");
  });

  it("leaves a rendering inline sibling alone", () => {
    const { $, $el } = firstEl("<div><br><h3>Title</h3></div>", "div");
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<br>");
    expect(r.block.content).toContain("<h3>Title</h3>");
  });

  it("leaves a container holding a table alone", () => {
    const { $, $el } = firstEl(
      "<div><table><tr><td><h3>In a cell</h3></td></tr></table></div>",
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<table>");
  });

  it("leaves a container alone when the table sits inside the heading", () => {
    // The one shape where refusing a table-holding container decides the
    // outcome on its own: the sole child *is* an unwrappable heading, and the
    // table is below it. Both traversals descend a container holding a table,
    // so this subtree belongs to them — typing it as a title here would claim
    // a mapping for markup `convertElement` never owns, and put a whole table
    // inside a title block.
    const { $, $el } = firstEl(
      '<div><h3>Heading <table role="presentation"><tr><td>cell</td></tr></table></h3></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry).toEqual({
      sourceTag: "div",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<h3>Heading ");
  });

  it("leaves an mjml column container alone", () => {
    // A `div.mj-column-per-*` holds a whole table, which is what keeps it out
    // of this rule: unwrapping it would hand `convertElement` a <table> it has
    // no mapping for, and the traversals reach its rows through the container
    // descent instead.
    const { $, $el } = firstEl(
      '<div class="mj-column-per-50 mj-outlook-group-fix" style="width:100%">' +
        "<table><tbody><tr><td><div><h3>Column copy</h3></div></td></tr></tbody></table>" +
        "</div>",
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toContain("<table>");
  });

  it("leaves a wrapped <p> alone, keeping the attributes it carries", () => {
    // `p` is deliberately outside the unwrap set. `convertParagraph` reads an
    // element's inner HTML, so unwrapping the <p> would drop it and every
    // attribute on it, where mapping the container keeps that markup inside
    // the paragraph's content — and a wrapped <p> is already a paragraph, so
    // there is no typing defect to trade it for.
    const { $, $el } = firstEl(
      '<div style="text-align:center"><p class="lead" dir="ltr">Wrapped copy</p></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry).toEqual({
      sourceTag: "div",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toBe(
      '<p class="lead" dir="ltr" style="text-align: center">Wrapped copy</p>',
    );
  });

  it("leaves a wrapped image alone", () => {
    // `img` is outside the unwrap set for the same reason: a wrapped image
    // already keeps its markup inside the paragraph, and admitting it would
    // widen a heading-typing rule into image mapping.
    const { $, $el } = firstEl(
      '<div><img src="hero.png" alt="Hero" width="600"></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry.sourceTag).toBe("div");
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toBe(
      '<p><img src="hero.png" alt="Hero" width="600"></p>',
    );
  });

  it("leaves a container of prose alone", () => {
    const { $, $el } = firstEl(
      '<div><span style="font-weight:bold">inline only</span></div>',
      "div",
    );
    const r = convertElement($el, $)!;
    expect(r.entry).toEqual({
      sourceTag: "div",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
    if (r.block.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(r.block.content).toBe(
      '<p><span style="font-weight:bold">inline only</span></p>',
    );
  });

  it("leaves an unknown element wrapping one block-level element alone", () => {
    const { $, $el } = firstEl("<article><h3>Title</h3></article>", "article");
    const r = convertElement($el, $)!;
    expect(r.entry).toEqual({
      sourceTag: "article",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: 'Unknown element "article" preserved as HTML block.',
    });
    if (r.block.type !== "html") throw new Error("expected html block");
    expect(r.block.content).toContain("<h3>Title</h3>");
  });
});
