import { describe, expect, it } from "vitest";
import { convertLeaf, isLeafType } from "../block-mapper";
import { contextFromPage } from "../normalize";
import type { EasyEmailProNode } from "../types";
import type {
  ButtonBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  ParagraphBlock,
  SocialIconsBlock,
  SpacerBlock,
  TableBlock,
  TitleBlock,
  VideoBlock,
} from "@templatical/types";

const emptyPage: EasyEmailProNode = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};
function map(
  node: EasyEmailProNode,
  page: EasyEmailProNode = emptyPage,
  contentWidth?: number,
) {
  return convertLeaf(node, {
    resolve: contextFromPage(page),
    warnings: [],
    ...(contentWidth !== undefined ? { contentWidth } : {}),
  });
}

function dividerWidth(
  attributes: Record<string, unknown>,
  contentWidth?: number,
): DividerBlock["width"] {
  const { blocks } = map(
    { type: "standard-divider", data: {}, attributes, children: [] },
    emptyPage,
    contentWidth,
  );
  return (blocks[0] as DividerBlock).width;
}

describe("convertLeaf", () => {
  it("maps a paragraph from children text, not from a missing field", () => {
    const { blocks, entries } = map({
      type: "standard-paragraph",
      data: {},
      attributes: { "font-size": "36px" },
      children: [{ text: "St. Patrick's Day" }],
    });
    expect(blocks[0].type).toBe("paragraph");
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="font-size: 36px">St. Patrick\'s Day</p>',
    );
    expect(entries[0]).toEqual({
      sourceTag: "standard-paragraph",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("maps standard-text to a paragraph, the same way as standard-paragraph", () => {
    const { blocks, entries } = map({
      type: "standard-text",
      data: {},
      attributes: {
        color: "#ff0000",
        "font-size": "18px",
        align: "center",
        "padding-top": "10px",
      },
      children: [{ text: "Hello " }, { text: "world", bold: true }],
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("paragraph");
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="color: #ff0000; font-size: 18px; text-align: center">Hello <strong>world</strong></p>',
    );
    expect(blocks[0].styles.padding).toEqual({
      top: 10,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(entries).toEqual([
      {
        sourceTag: "standard-text",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
    ]);
  });

  it("keeps the inline html-node children of a standard-text", () => {
    const { blocks, entries } = map({
      type: "standard-text",
      data: {},
      attributes: { align: "center", "font-size": "56px" },
      children: [
        { text: "" },
        {
          type: "html-node",
          data: { tagName: "em" },
          attributes: { style: "font-style: italic" },
          children: [{ text: "The Studio," }],
        },
        { text: "" },
        {
          type: "html-node",
          data: { tagName: "br" },
          attributes: {},
          children: [{ text: "" }],
        },
        { text: "est. 2019" },
      ],
    });
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="font-size: 56px; text-align: center"><em style="font-style: italic">The Studio,</em><br />est. 2019</p>',
    );
    expect(entries[0].status).toBe("converted");
  });

  it("keeps a mergetag inside a paragraph as a liquid token", () => {
    const { blocks } = map({
      type: "standard-paragraph",
      data: {},
      attributes: {},
      children: [
        { text: "Hello " },
        {
          type: "mergetag",
          data: {},
          attributes: {},
          children: [{ text: "customer.name" }],
        },
        { text: ", here is your order" },
      ],
    });
    expect((blocks[0] as ParagraphBlock).content).toBe(
      "Hello {{ customer.name }}, here is your order",
    );
  });

  it("html-fallbacks an html-node that sits in a column on its own", () => {
    const node: EasyEmailProNode = {
      type: "html-node",
      data: { tagName: "span" },
      attributes: {},
      children: [{ text: "stray" }],
    };
    const { blocks, entries } = map(node);
    expect(blocks[0].type).toBe("html");
    expect((blocks[0] as HtmlBlock).content).toBe(JSON.stringify(node));
    expect(entries[0]).toEqual({
      sourceTag: "html-node",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: 'Unknown Easy Email Pro type "html-node"; preserved as HTML.',
    });
  });

  it("reads standard-text through blockAttributes and the TEXT category", () => {
    const page: EasyEmailProNode = {
      type: "page",
      data: {
        blockAttributes: { "standard-text": { color: "#00ff00" } },
        categoryAttributes: { TEXT: { "padding-left": "7px" } },
      },
      attributes: {},
      children: [],
    };
    const { blocks } = map(
      {
        type: "standard-text",
        data: {},
        attributes: {},
        children: [{ text: "Cascade" }],
      },
      page,
    );
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="color: #00ff00">Cascade</p>',
    );
    expect(blocks[0].styles.padding.left).toBe(7);
  });

  it("maps standard-h1 to Title level 1", () => {
    const { blocks } = map({
      type: "standard-h1",
      data: {},
      attributes: {},
      children: [{ text: "Hello" }],
    });
    expect(blocks[0].type).toBe("title");
    expect((blocks[0] as TitleBlock).level).toBe(1);
    expect((blocks[0] as TitleBlock).content).toBe("Hello");
  });

  it("uses button children text, not data.content", () => {
    const { blocks } = map({
      type: "standard-button",
      data: { content: "Button" },
      attributes: {
        "background-color": "#C5900C",
        href: "https://x.test",
        width: "100%",
      },
      children: [{ text: "Book a table" }],
    });
    const b = blocks[0] as ButtonBlock;
    expect(b.text).toBe("Book a table");
    expect(b.url).toBe("https://x.test");
    expect(b.backgroundColor).toBe("#C5900C");
    expect(b.width).toBe("full");
  });

  it("does not keep factory #333333 on an outlined button", () => {
    const { blocks, entries } = map({
      type: "standard-button",
      data: { content: "Button" },
      attributes: {
        "border-enabled": true,
        "border-color": "#C5900C",
        "border-width": "3px",
        color: "#C5900C",
      },
      children: [{ text: "Ghost" }],
    });
    const b = blocks[0] as ButtonBlock;
    expect(b.backgroundColor).toBe("#ffffff");
    expect(b.textColor).toBe("#C5900C");
    expect(entries[0].status).toBe("approximated");
    expect(entries[0].note).toMatch(/outline/i);
  });

  it("maps an image src and href", () => {
    const { blocks } = map({
      type: "standard-image",
      data: {},
      attributes: {
        src: "https://cdn.test/x.png",
        href: "https://x.test",
        alt: "Hero",
      },
      children: [{ text: "" }],
    });
    const img = blocks[0] as ImageBlock;
    expect(img.src).toBe("https://cdn.test/x.png");
    expect(img.linkUrl).toBe("https://x.test");
    expect(img.alt).toBe("Hero");
  });

  it("skips placeholder with no entry", () => {
    const { blocks, entries } = map({
      type: "placeholder",
      data: {},
      attributes: {},
      children: [{ text: "" }],
    });
    expect(blocks).toEqual([]);
    expect(entries).toEqual([]);
  });

  it("bakes blockAttributes paragraph color into content HTML", () => {
    const page: EasyEmailProNode = {
      type: "page",
      data: { blockAttributes: { "standard-paragraph": { color: "#FFFFFF" } } },
      attributes: {},
      children: [],
    };
    const { blocks } = map(
      {
        type: "standard-paragraph",
        data: {},
        attributes: {},
        children: [{ text: "Hi" }],
      },
      page,
    );
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="color: #FFFFFF">Hi</p>',
    );
  });

  it("maps marketing-countdown to overlay text plus an image, never countdown", () => {
    const { blocks, entries } = map({
      type: "marketing-countdown",
      data: { remainingTime: 24, unit: "hour" },
      attributes: { src: "https://cdn.test/timer.gif" },
      children: [
        {
          type: "text",
          attributes: { color: "#ffffff" },
          children: [{ text: "SUMMER SALE" }],
        },
      ],
    });
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "image"]);
    expect((blocks[0] as ParagraphBlock).content).toBe(
      '<p style="color: #ffffff">SUMMER SALE</p>',
    );
    expect((blocks[1] as ImageBlock).src).toBe("https://cdn.test/timer.gif");
    expect(blocks.some((b) => b.type === "countdown")).toBe(false);
    expect(entries.every((e) => e.status === "approximated")).toBe(true);
  });

  it("html-fallbacks an unknown type with JSON.stringify", () => {
    const node: EasyEmailProNode = {
      type: "amp_carousel",
      data: {},
      attributes: {},
      children: [],
    };
    const { blocks, entries } = map(node);
    expect(blocks[0].type).toBe("html");
    expect((blocks[0] as { content: string }).content).toBe(
      JSON.stringify(node),
    );
    expect(entries[0]).toEqual({
      sourceTag: "amp_carousel",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: 'Unknown Easy Email Pro type "amp_carousel"; preserved as HTML.',
    });
  });

  it("maps raw to an HtmlBlock holding data.content", () => {
    const { blocks, entries } = map({
      type: "raw",
      data: { content: '<!-- htmlmin:ignore --><div class="x">Raw</div>' },
      attributes: {},
      children: [],
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("html");
    expect((blocks[0] as HtmlBlock).content).toBe(
      '<!-- htmlmin:ignore --><div class="x">Raw</div>',
    );
    expect(blocks[0].styles.padding).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(entries).toEqual([
      {
        sourceTag: "raw",
        templaticalBlockType: "html",
        status: "converted",
      },
    ]);
  });

  it("html-fallbacks a raw node whose data.content is not a string", () => {
    const node: EasyEmailProNode = {
      type: "raw",
      data: { value: { content: "<!-- legacy -->" } },
      attributes: {},
      children: [],
    };
    const { blocks, entries } = map(node);
    expect((blocks[0] as HtmlBlock).content).toBe(JSON.stringify(node));
    expect(entries[0].status).toBe("html-fallback");
    expect(entries[0].sourceTag).toBe("raw");
  });

  it("maps a divider as converted", () => {
    const { blocks, entries } = map({
      type: "standard-divider",
      data: {},
      attributes: {},
      children: [],
    });
    expect(blocks[0].type).toBe("divider");
    expect(entries[0]).toEqual({
      sourceTag: "standard-divider",
      templaticalBlockType: "divider",
      status: "converted",
    });
  });

  it("makes a divider full-width when its width is missing or 100%", () => {
    expect(dividerWidth({})).toBe("full");
    expect(dividerWidth({ width: "" })).toBe("full");
    expect(dividerWidth({ width: "100%" })).toBe("full");
    expect(dividerWidth({ width: "auto" })).toBe("full");
  });

  it("keeps any other percentage, clamped to 0-100", () => {
    expect(dividerWidth({ width: "50%" })).toBe("50%");
    expect(dividerWidth({ width: " 12.5 % " })).toBe("12.5%");
    expect(dividerWidth({ width: "33.333%" })).toBe("33.33%");
    expect(dividerWidth({ width: "0%" })).toBe("0%");
    expect(dividerWidth({ width: "-10%" })).toBe("0%");
    expect(dividerWidth({ width: "150%" })).toBe("full");
  });

  it("keeps a px divider width when the column width is unknown", () => {
    expect(dividerWidth({ width: "300px" })).toBe(300);
    expect(dividerWidth({ width: 120 })).toBe(120);
  });

  it("makes a px divider full once it fills the room its column leaves it", () => {
    expect(dividerWidth({ width: "300px" }, 300)).toBe("full");
    expect(dividerWidth({ width: "301px" }, 300)).toBe("full");
    expect(dividerWidth({ width: "299px" }, 300)).toBe(299);
    const padded = { "padding-left": "25px", "padding-right": "25px" };
    expect(dividerWidth({ ...padded, width: "550px" }, 600)).toBe("full");
    expect(dividerWidth({ ...padded, width: "549px" }, 600)).toBe(549);
  });

  it("maps a spacer height from px", () => {
    const { blocks, entries } = map({
      type: "standard-spacer",
      data: {},
      attributes: { height: "40px" },
      children: [],
    });
    expect(blocks[0].type).toBe("spacer");
    expect((blocks[0] as SpacerBlock).height).toBe(40);
    expect(entries[0]).toEqual({
      sourceTag: "standard-spacer",
      templaticalBlockType: "spacer",
      status: "converted",
    });
  });

  it("maps navbar links onto menu items", () => {
    const { blocks, entries } = map({
      type: "standard-navbar",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-navbar-link",
          data: {},
          attributes: { href: "https://a.test" },
          children: [{ text: "Home" }],
        },
        {
          type: "standard-navbar-link",
          data: {},
          attributes: { href: "https://b.test" },
          children: [{ text: "Menu" }],
        },
      ],
    });
    const menu = blocks[0] as MenuBlock;
    expect(menu.type).toBe("menu");
    expect(menu.items).toHaveLength(2);
    expect(menu.items[0].text).toBe("Home");
    expect(menu.items[0].url).toBe("https://a.test");
    expect(menu.items[1].text).toBe("Menu");
    expect(menu.items[1].url).toBe("https://b.test");
    expect(entries[0]).toEqual({
      sourceTag: "standard-navbar",
      templaticalBlockType: "menu",
      status: "converted",
    });
  });

  it("maps a social element platform from the src path and approximates custom src", () => {
    const { blocks, entries } = map({
      type: "standard-social",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-social-element",
          data: {},
          attributes: {
            src: "https://cdn.test/icons/facebook.png",
            href: "https://example.com/x",
          },
          children: [],
        },
      ],
    });
    const social = blocks[0] as SocialIconsBlock;
    expect(social.type).toBe("social");
    expect(social.icons).toHaveLength(1);
    expect(social.icons[0].platform).toBe("facebook");
    expect(social.icons[0].url).toBe("https://example.com/x");
    expect(entries[0].status).toBe("approximated");
    expect(entries[0].sourceTag).toBe("standard-social");
    expect(entries[0].templaticalBlockType).toBe("social");
    expect(entries[0].note).toMatch(/src/i);
  });

  it("maps table2 rows and cells from serialiseChildren", () => {
    const { blocks, entries } = map({
      type: "standard-table2",
      data: {},
      attributes: {},
      children: [
        {
          type: "tr",
          data: {},
          attributes: {},
          children: [
            {
              type: "td",
              data: {},
              attributes: {},
              children: [{ text: "A" }],
            },
            {
              type: "td",
              data: {},
              attributes: {},
              children: [{ text: "B" }],
            },
          ],
        },
      ],
    });
    const table = blocks[0] as TableBlock;
    expect(table.type).toBe("table");
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells).toHaveLength(2);
    expect(table.rows[0].cells[0].content).toBe("A");
    expect(table.rows[0].cells[1].content).toBe("B");
    expect(entries[0]).toEqual({
      sourceTag: "standard-table2",
      templaticalBlockType: "table",
      status: "converted",
    });
  });

  it("maps table2 rows and cells from the standard-table2-tr / -td shape", () => {
    const td = (text: string, bold = false): EasyEmailProNode => ({
      type: "standard-table2-td",
      data: { rowspan: 1, colspan: 1 },
      attributes: {},
      children: [{ text, ...(bold ? { bold: true } : {}) }],
    });
    const { blocks, entries } = map({
      type: "standard-table2",
      data: {},
      attributes: { cellpadding: "10px" },
      children: [
        {
          type: "standard-table2-tr",
          data: {},
          attributes: { "background-color": "#7daa55" },
          children: [td("Item", true), td("Price", true)],
        },
        {
          type: "standard-table2-tr",
          data: {},
          attributes: {},
          children: [td("Tea"), td("$4")],
        },
      ],
    });
    const table = blocks[0] as TableBlock;
    expect(table.type).toBe("table");
    expect(
      table.rows.map((row) => row.cells.map((cell) => cell.content)),
    ).toEqual([
      ["<strong>Item</strong>", "<strong>Price</strong>"],
      ["Tea", "$4"],
    ]);
    expect(table.hasHeaderRow).toBe(false);
    expect(entries).toEqual([
      {
        sourceTag: "standard-table2",
        templaticalBlockType: "table",
        status: "converted",
      },
    ]);
  });

  it("keeps a table2 row nested one level inside a table body", () => {
    const { blocks } = map({
      type: "standard-table2",
      data: {},
      attributes: {},
      children: [
        {
          type: "tbody",
          data: {},
          attributes: {},
          children: [
            {
              type: "standard-table2-tr",
              data: {},
              attributes: {},
              children: [
                {
                  type: "standard-table2-td",
                  data: {},
                  attributes: {},
                  children: [{ text: "Nested row" }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect((blocks[0] as TableBlock).rows[0].cells[0].content).toBe(
      "Nested row",
    );
  });

  it("skips a navbar with no links and writes no entry", () => {
    const { blocks, entries } = map({
      type: "standard-navbar",
      data: {},
      attributes: {},
      children: [],
    });
    expect(blocks).toEqual([]);
    expect(entries).toEqual([]);
  });

  it("maps common-video with a URL to a video block", () => {
    const { blocks, entries } = map({
      type: "common-video",
      data: {},
      attributes: { src: "https://youtube.com/watch?v=abc" },
      children: [],
    });
    const video = blocks[0] as VideoBlock;
    expect(video.type).toBe("video");
    expect(video.url).toBe("https://youtube.com/watch?v=abc");
    expect(entries[0]).toEqual({
      sourceTag: "common-video",
      templaticalBlockType: "video",
      status: "converted",
    });
  });

  it("html-fallbacks common-video without a URL", () => {
    const node: EasyEmailProNode = {
      type: "common-video",
      data: {},
      attributes: {},
      children: [],
    };
    const { blocks, entries } = map(node);
    expect(blocks[0].type).toBe("html");
    expect((blocks[0] as HtmlBlock).content).toBe(JSON.stringify(node));
    expect(entries[0].status).toBe("html-fallback");
    expect(entries[0].sourceTag).toBe("common-video");
  });

  it("clamps a heading past h4 to level 4 and approximates", () => {
    const { blocks, entries } = map({
      type: "standard-h5",
      data: {},
      attributes: {},
      children: [{ text: "Small" }],
    });
    expect((blocks[0] as TitleBlock).type).toBe("title");
    expect((blocks[0] as TitleBlock).level).toBe(4);
    expect((blocks[0] as TitleBlock).content).toBe("Small");
    expect(entries[0].status).toBe("approximated");
    expect(entries[0].note).toMatch(/h5/i);
  });

  it("omits image linkUrl when href is unset", () => {
    const { blocks } = map({
      type: "standard-image",
      data: {},
      attributes: { src: "https://cdn.test/x.png", alt: "Hero" },
      children: [{ text: "" }],
    });
    expect("linkUrl" in blocks[0]).toBe(false);
  });

  it("maps image border-radius when greater than 0", () => {
    const { blocks } = map({
      type: "standard-image",
      data: {},
      attributes: {
        src: "https://cdn.test/x.png",
        "border-radius": "8px",
      },
      children: [{ text: "" }],
    });
    expect((blocks[0] as ImageBlock).borderRadius).toBe(8);
  });

  it("keeps a standard-text overlay on a marketing-countdown", () => {
    const { blocks, entries } = map({
      type: "marketing-countdown",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-text",
          data: {},
          attributes: {},
          children: [{ text: "ENDS SOON" }],
        },
      ],
    });
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    expect((blocks[0] as ParagraphBlock).content).toBe("ENDS SOON");
    expect(entries).toEqual([
      {
        sourceTag: "marketing-countdown",
        templaticalBlockType: "paragraph",
        status: "approximated",
        note: "marketing-countdown GIF is the timer; Templatical countdown is Cloud-only",
      },
    ]);
  });

  it("skips the countdown image when src is unset", () => {
    const { blocks, entries } = map({
      type: "marketing-countdown",
      data: {},
      attributes: {},
      children: [
        {
          type: "text",
          attributes: {},
          children: [{ text: "SALE" }],
        },
      ],
    });
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    expect(entries.every((e) => e.status === "approximated")).toBe(true);
    expect(
      entries.every((e) => String(e.note).includes("marketing-countdown")),
    ).toBe(true);
  });

  it("reads leaf padding from attributes", () => {
    const { blocks } = map({
      type: "standard-paragraph",
      data: {},
      attributes: {
        "padding-top": "12px",
        "padding-right": "8px",
        "padding-bottom": "4px",
        "padding-left": "2px",
      },
      children: [{ text: "Padded" }],
    });
    expect(blocks[0].styles.padding).toEqual({
      top: 12,
      right: 8,
      bottom: 4,
      left: 2,
    });
  });

  it("maps visible desktop and omits visibility when absent", () => {
    const desktop = map({
      type: "standard-paragraph",
      data: {},
      attributes: {},
      visible: "desktop",
      children: [{ text: "Desk" }],
    });
    expect(desktop.blocks[0].visibility).toEqual({
      desktop: true,
      mobile: false,
    });

    const absent = map({
      type: "standard-paragraph",
      data: {},
      attributes: {},
      children: [{ text: "All" }],
    });
    expect("visibility" in absent.blocks[0]).toBe(false);
  });
});

describe("isLeafType", () => {
  it("recognises listed leaves including placeholder and common-video", () => {
    expect(isLeafType("standard-paragraph")).toBe(true);
    expect(isLeafType("standard-text")).toBe(true);
    expect(isLeafType("raw")).toBe(true);
    expect(isLeafType("standard-h3")).toBe(true);
    expect(isLeafType("placeholder")).toBe(true);
    expect(isLeafType("common-video")).toBe(true);
    expect(isLeafType("marketing-countdown")).toBe(true);
  });

  it("rejects structure nodes and missing types", () => {
    expect(isLeafType("standard-section")).toBe(false);
    expect(isLeafType("standard-column")).toBe(false);
    expect(isLeafType(undefined)).toBe(false);
  });
});
