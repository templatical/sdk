import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type {
  MenuBlock,
  ParagraphBlock,
  TableBlock,
  TitleBlock,
} from "@templatical/types";
import {
  buildAttributeCascade,
  resolveAttributes,
} from "../attribute-resolver";
import { convertTextElement } from "../text-inference";
import type { ConvertContext } from "../block-base";

function convert(inner: string, attrsMarkup = "") {
  const $: CheerioAPI = load(
    `<mjml><mj-body><mj-text ${attrsMarkup}>${inner}</mj-text></mj-body></mjml>`,
    { xml: { xmlMode: false, recognizeSelfClosing: true } },
  );
  const ctx: ConvertContext = {
    $,
    cascade: buildAttributeCascade($),
    containerWidth: 600,
    warnings: [],
  };
  const $el = $("mj-text").first() as unknown as Cheerio<Element>;
  return {
    result: convertTextElement($el, resolveAttributes($el, ctx.cascade), ctx),
    ctx,
  };
}

describe("title inference", () => {
  it("reads a single heading root as a title, keeping its level", () => {
    const { result } = convert('<h3 style="margin:0">Big news</h3>');
    const block = result.block as TitleBlock;

    expect(block.type).toBe("title");
    expect(block.level).toBe(3);
    expect(block.content).toBe("Big news");
    expect(result.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "title",
      status: "converted",
    });
  });

  it("clamps h5 to level 4 and reports it as approximated", () => {
    const { result } = convert("<h5>Small</h5>");

    expect((result.block as TitleBlock).level).toBe(4);
    expect(result.entry.status).toBe("approximated");
    expect(result.entry.note).toBe(
      "Heading level h5 clamped to 4 — Templatical titles support h1-h4.",
    );
  });

  it("does not read two headings as a title", () => {
    const { result } = convert("<h1>A</h1><h2>B</h2>");
    expect(result.block!.type).toBe("paragraph");
  });

  it("reads alignment", () => {
    const { result } = convert("<h2>T</h2>", 'align="center"');
    const block = result.block as TitleBlock;

    expect(block.textAlign).toBe("center");
  });
});

describe("table inference", () => {
  it("reads a single table root as a table block", () => {
    const { result } = convert(
      "<table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>",
    );
    const block = result.block as TableBlock;

    expect(block.type).toBe("table");
    expect(block.hasHeaderRow).toBe(true);
    expect(block.rows).toHaveLength(2);
    expect(block.rows[0].cells.map((c) => c.content)).toEqual(["H1", "H2"]);
    expect(block.rows[1].cells.map((c) => c.content)).toEqual(["a", "b"]);
    expect(result.entry.templaticalBlockType).toBe("table");
  });

  it("reads hasHeaderRow false when the first row has no th", () => {
    const { result } = convert("<table><tr><td>a</td></tr></table>");
    expect((result.block as TableBlock).hasHeaderRow).toBe(false);
  });
});

describe("menu inference", () => {
  it("reads top-level anchors as a menu block", () => {
    const { result } = convert(
      '<a href="/a">Alpha</a><span style="color: #cccccc; padding: 0 12px;">|</span><a href="/b">Beta</a>',
    );
    const block = result.block as MenuBlock;

    expect(block.type).toBe("menu");
    expect(block.items.map((i) => [i.text, i.url])).toEqual([
      ["Alpha", "/a"],
      ["Beta", "/b"],
    ]);
    expect(block.separator).toBe("|");
    expect(block.separatorColor).toBe("#cccccc");
    expect(result.entry.templaticalBlockType).toBe("menu");
  });

  it("does not read a paragraph-wrapped anchor as a menu", () => {
    const { result } = convert('<p><a href="/a">Alpha</a></p>');
    expect(result.block!.type).toBe("paragraph");
  });

  it("marks an anchor with target=_blank as opening in a new tab", () => {
    const { result } = convert('<a href="/a" target="_blank">Alpha</a>');
    expect((result.block as MenuBlock).items[0].openInNewTab).toBe(true);
  });
});

describe("paragraph fallback", () => {
  it("reads ordinary rich text as a paragraph, preserving markup", () => {
    const { result } = convert("<p>Hello <strong>world</strong></p>");
    const block = result.block as ParagraphBlock;

    expect(block.type).toBe("paragraph");
    expect(block.content).toBe("<p>Hello <strong>world</strong></p>");
    expect(result.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("wraps bare text in a paragraph element", () => {
    const { result } = convert("Just words");
    expect((result.block as ParagraphBlock).content).toBe("<p>Just words</p>");
  });

  it("keeps a bare <br> a void element, so the text after it stays a sibling instead of being swallowed as its child", () => {
    // This is exactly the markup TipTap emits for a hard break and that
    // browser DOM serialization produces: a <br> with no trailing slash. A
    // parser that treats <br> as an ordinary (non-void) element leaves it
    // open, so "Line two" becomes ITS CHILD rather than the next sibling —
    // serialized back out, that reads as `<br>Line two</br>`, and reparsing
    // that anywhere downstream (e.g. loading the block into the editor)
    // invents a second <br> from the dangling `</br>` end tag.
    const { result } = convert("<p>Line one<br>Line two</p>");
    const block = result.block as ParagraphBlock;

    expect(block.content).toBe("<p>Line one<br>Line two</p>");
    expect(block.content).not.toContain("</br>");
  });

  it("never sets colour on a paragraph — colour is document-level", () => {
    // ParagraphBlock has no `color` field: paragraph text colour comes from
    // the document's `settings.textColor`, so an `mj-text` colour attribute
    // is not recovered into the block.
    const { result } = convert("<p>x</p>", 'color="#445566"');
    expect("color" in result.block!).toBe(false);
  });
});

describe("paragraph gap recovery", () => {
  it("recovers a custom paragraph gap from css-class", () => {
    const { result } = convert("<p>x</p>", 'css-class="tpl-rich-text-16"');
    expect((result.block as ParagraphBlock).paragraphSpacing).toBe(16);
  });

  it("omits paragraphSpacing when the gap class matches the default", () => {
    const { result } = convert("<p>x</p>", 'css-class="tpl-rich-text-8"');
    expect("paragraphSpacing" in result.block!).toBe(false);
  });

  it("omits paragraphSpacing when no gap class is present", () => {
    const { result } = convert("<p>x</p>");
    expect("paragraphSpacing" in result.block!).toBe(false);
  });

  it("recovers a fractional paragraph gap", () => {
    const { result } = convert("<p>x</p>", 'css-class="tpl-rich-text-8.5"');
    expect((result.block as ParagraphBlock).paragraphSpacing).toBe(8.5);
  });

  it("ignores a paragraph-gap class on a title, which has no such field", () => {
    const { result } = convert("<h2>T</h2>", 'css-class="tpl-rich-text-16"');
    expect(result.block!.type).toBe("title");
    expect("paragraphSpacing" in result.block!).toBe(false);
  });
});
