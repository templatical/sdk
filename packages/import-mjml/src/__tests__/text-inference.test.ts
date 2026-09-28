import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type {
  ContentDirection,
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

function convert(
  inner: string,
  attrsMarkup = "",
  direction: ContentDirection = "ltr",
) {
  return convertWithHead("", inner, attrsMarkup, direction);
}

/** Same as {@link convert}, with an `<mj-head>` block to seed the attribute cascade. */
function convertWithHead(
  head: string,
  inner: string,
  attrsMarkup = "",
  direction: ContentDirection = "ltr",
) {
  const $: CheerioAPI = load(
    `<mjml><mj-head>${head}</mj-head><mj-body><mj-text ${attrsMarkup}>${inner}</mj-text></mj-body></mjml>`,
    { xml: { xmlMode: false, recognizeSelfClosing: true } },
  );
  const ctx: ConvertContext = {
    $,
    cascade: buildAttributeCascade($),
    containerWidth: 600,
    columnPadding: 0,
    direction,
    warnings: [],
  };
  // Scoped to mj-body: a head carrying its own <mj-attributes><mj-text .../>
  // declaration means "mj-text" alone would match that declaration first,
  // not the content element under test.
  const $el = $("mj-body mj-text").first() as unknown as Cheerio<Element>;
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

  it("does not read the document's mj-attributes cascade as its own color or font-family", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      "<h2>T</h2>",
    );
    const block = result.block as TitleBlock;

    expect("color" in block).toBe(false);
    expect("fontFamily" in block).toBe(false);
  });

  it("reads its own color and font-family over the cascade default", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      "<h2>T</h2>",
      'color="#abcdef" font-family="Verdana"',
    );
    const block = result.block as TitleBlock;

    expect(block.color).toBe("#abcdef");
    expect(block.fontFamily).toBe("Verdana");
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

  it("does not read the document's mj-attributes cascade as its own color or font-family", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      "<table><tr><td>a</td></tr></table>",
    );
    const block = result.block as TableBlock;

    expect("color" in block).toBe(false);
    expect("fontFamily" in block).toBe(false);
  });

  it("reads its own color and font-family over the cascade default", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      "<table><tr><td>a</td></tr></table>",
      'color="#abcdef" font-family="Verdana"',
    );
    const block = result.block as TableBlock;

    expect(block.color).toBe("#abcdef");
    expect(block.fontFamily).toBe("Verdana");
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

  it("still reads anchors separated by newlines and a span as a menu", () => {
    const { result } = convert(
      '<a href="/a">Alpha</a>\n<span style="color: #cccccc; padding: 0 12px;">|</span>\n<a href="/b">Beta</a>',
    );
    const block = result.block as MenuBlock;

    expect(block.type).toBe("menu");
    expect(block.items.map((i) => [i.text, i.url])).toEqual([
      ["Alpha", "/a"],
      ["Beta", "/b"],
    ]);
    expect(block.separator).toBe("|");
    expect(result.entry.templaticalBlockType).toBe("menu");
  });

  it("does not read prose plus a trailing anchor as a menu", () => {
    // An mj-text of copy plus a trailing <a> is a paragraph. Classifying it
    // as a menu keeps only the link labels and discards the prose.
    const { result } = convert(
      'No longer want to receive these emails? You can <a href="https://example.com/unsub">unsubscribe here</a>.',
    );
    const block = result.block as ParagraphBlock;

    expect(block.type).toBe("paragraph");
    expect(block.content).toBe(
      '<p>No longer want to receive these emails? You can <a href="https://example.com/unsub">unsubscribe here</a>.</p>',
    );
    expect(result.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("does not read anchors separated by a text-node pipe as a menu", () => {
    const { result } = convert(
      "<a>View in browser</a> &nbsp;|&nbsp; <a>Unsubscribe</a>",
    );
    const block = result.block as ParagraphBlock;

    expect(block.type).toBe("paragraph");
    expect(block.content).toBe(
      "<p><a>View in browser</a> &#xa0;|&#xa0; <a>Unsubscribe</a></p>",
    );
    expect(result.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("marks an anchor with target=_blank as opening in a new tab", () => {
    const { result } = convert('<a href="/a" target="_blank">Alpha</a>');
    expect((result.block as MenuBlock).items[0].openInNewTab).toBe(true);
  });

  it("does not read the document's mj-attributes cascade as its own color or font-family", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      '<a href="/a">Alpha</a><a href="/b">Beta</a>',
    );
    const block = result.block as MenuBlock;

    expect("color" in block).toBe(false);
    expect("fontFamily" in block).toBe(false);
  });

  it("reads its own color and font-family over the cascade default", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-all font-family="Georgia" /><mj-text color="#123456" /></mj-attributes>',
      '<a href="/a">Alpha</a><a href="/b">Beta</a>',
      'color="#abcdef" font-family="Verdana"',
    );
    const block = result.block as MenuBlock;

    expect(block.color).toBe("#abcdef");
    expect(block.fontFamily).toBe("Verdana");
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

  it("carries an mj-text colour in the markup, since ParagraphBlock has no color field", () => {
    const { result } = convert("<p>x</p>", 'color="#445566"');
    const block = result.block as ParagraphBlock;

    expect("color" in block).toBe(false);
    expect(block.content).toBe('<p><span style="color: #445566;">x</span></p>');
  });
});

describe("paragraph alignment, colour and size", () => {
  it("puts the alignment on the <p> and the colour and size in a span inside it", () => {
    const { result } = convert(
      "<p>Hello <strong>world</strong></p>",
      'align="center" color="#4b5563" font-size="15px"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: center;"><span style="color: #4b5563; font-size: 15px;">Hello <strong>world</strong></span></p>',
    );
    expect(result.entry).toEqual({
      sourceTag: "mj-text",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("wraps bare text in a <p> before styling it", () => {
    const { result } = convert("Just words", 'align="center"');

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: center;">Just words</p>',
    );
  });

  it("styles every paragraph, keeping an empty one free of a span", () => {
    const { result } = convert(
      "<p>One</p><p></p><p>Two</p>",
      'align="right" color="#4b5563"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: right;"><span style="color: #4b5563;">One</span></p>' +
        '<p style="text-align: right;"></p>' +
        '<p style="text-align: right;"><span style="color: #4b5563;">Two</span></p>',
    );
  });

  it("skips left, the start edge, in an LTR document", () => {
    const { result } = convert("<p>x</p>", 'align="left"', "ltr");
    expect((result.block as ParagraphBlock).content).toBe("<p>x</p>");
  });

  it("applies right in an LTR document", () => {
    const { result } = convert("<p>x</p>", 'align="right"', "ltr");
    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: right;">x</p>',
    );
  });

  it("skips right, the start edge, in an RTL document", () => {
    const { result } = convert("<p>x</p>", 'align="right"', "rtl");
    expect((result.block as ParagraphBlock).content).toBe("<p>x</p>");
  });

  it("applies left in an RTL document", () => {
    const { result } = convert("<p>x</p>", 'align="left"', "rtl");
    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: left;">x</p>',
    );
  });

  it("keeps justify, which the paragraph editor supports", () => {
    const { result } = convert("<p>x</p>", 'align="justify"');
    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: justify;">x</p>',
    );
  });

  it("reads alignment, colour and size that arrive through mj-class", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-class name="lead" align="center" color="#4b5563" font-size="18px" /></mj-attributes>',
      "<p>x</p>",
      'mj-class="lead"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: center;"><span style="color: #4b5563; font-size: 18px;">x</span></p>',
    );
  });

  it("applies a document-wide font size, which has no setting to land in", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-text font-size="16px" /></mj-attributes>',
      "<p>x</p>",
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p><span style="font-size: 16px;">x</span></p>',
    );
  });

  it("does not repeat the document-wide colour, which is settings.textColor", () => {
    const { result } = convertWithHead(
      '<mj-attributes><mj-text color="#123456" /></mj-attributes>',
      "<p>x</p>",
      'align="center"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: center;">x</p>',
    );
  });

  it("skips 14px, the renderer's own mj-text size", () => {
    const { result } = convert("<p>x</p>", 'font-size="14px"');
    expect((result.block as ParagraphBlock).content).toBe("<p>x</p>");
  });

  it("lets the <p>'s own colour, size and alignment win over the attributes", () => {
    const { result } = convert(
      '<p style="margin: 0; color: #ff0000; text-align: right; font-size: 20px;">x</p>',
      'align="center" color="#4b5563" font-size="15px"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="margin: 0; text-align: right;"><span style="color: #ff0000; font-size: 20px;">x</span></p>',
    );
  });

  it("moves the <p>'s own colour into the span when only alignment applies", () => {
    const { result } = convert(
      '<p style="color: #ff0000;">x</p>',
      'align="center"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p style="text-align: center;"><span style="color: #ff0000;">x</span></p>',
    );
  });

  it("leaves a span already inside the paragraph with its own values", () => {
    const { result } = convert(
      '<p>a <span style="color: #ff0000; font-size: 20px;">b</span></p>',
      'color="#4b5563" font-size="15px"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p><span style="color: #4b5563; font-size: 15px;">a <span style="color: #ff0000; font-size: 20px;">b</span></span></p>',
    );
  });

  it("keeps merge tags and a hard break inside the span", () => {
    const { result } = convert(
      "<p>Hi {{first_name}},<br>welcome</p>",
      'color="#4b5563"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      '<p><span style="color: #4b5563;">Hi {{first_name}},<br>welcome</span></p>',
    );
  });

  it("wraps bare list-item text in a <p> first", () => {
    const { result } = convert(
      "<ul><li>One</li><li><p>Two</p></li></ul>",
      'align="center" color="#4b5563"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      "<ul>" +
        '<li><p style="text-align: center;"><span style="color: #4b5563;">One</span></p></li>' +
        '<li><p style="text-align: center;"><span style="color: #4b5563;">Two</span></p></li>' +
        "</ul>",
    );
  });

  it("wraps a list item's text but not the nested list after it", () => {
    const { result } = convert(
      "<ol><li><strong>One</strong> first<ul><li>Sub</li></ul></li></ol>",
      'align="center"',
    );

    expect((result.block as ParagraphBlock).content).toBe(
      "<ol><li>" +
        '<p style="text-align: center;"><strong>One</strong> first</p>' +
        '<ul><li><p style="text-align: center;">Sub</p></li></ul>' +
        "</li></ol>",
    );
  });

  it("leaves the markup byte-for-byte untouched when nothing applies", () => {
    const inner = '<p style="margin:0">a&nbsp;b<br>c</p><ul><li>d</li></ul>';
    const { result: plain } = convert(inner);
    const { result } = convertWithHead(
      '<mj-attributes><mj-text color="#123456" /></mj-attributes>',
      inner,
      'align="left" font-size="14px" color="#123456"',
    );

    expect((plain.block as ParagraphBlock).content).toBe(
      '<p style="margin:0">a&#xa0;b<br>c</p><ul><li>d</li></ul>',
    );
    expect((result.block as ParagraphBlock).content).toBe(
      (plain.block as ParagraphBlock).content,
    );
  });

  it("ignores values it cannot read", () => {
    const { result } = convert(
      "<p>x</p>",
      'align="middle" color="not-a-colour" font-size="1.2em"',
    );
    expect((result.block as ParagraphBlock).content).toBe("<p>x</p>");
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
