import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import {
  convertElement,
  convertHtmlFallback,
  isButtonCell,
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

  it("plain anchor falls back to paragraph (approximated)", () => {
    const { $, $el } = firstEl('<a href="https://x.com">link</a>', "a");
    const r = convertElement($el, $)!;
    expect(r.entry.templaticalBlockType).toBe("paragraph");
    expect(r.entry.status).toBe("approximated");
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
});
