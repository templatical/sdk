import { describe, expect, it } from "vitest";
import { convertLeaf, isLeafType } from "../block-mapper";
import { contextFromPage } from "../normalize";
import type { EasyEmailProNode } from "../types";
import type {
  ButtonBlock,
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
function map(node: EasyEmailProNode, page: EasyEmailProNode = emptyPage) {
  return convertLeaf(node, {
    resolve: contextFromPage(page),
    warnings: [],
  });
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
