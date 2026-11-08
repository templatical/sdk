import { describe, expect, it } from "vitest";
import { buildTopLevel } from "../section-builder";
import { contextFromPage } from "../normalize";
import type { EasyEmailProNode } from "../types";
import type { Block, DividerBlock, SectionBlock } from "@templatical/types";

const page: EasyEmailProNode = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};
function build(
  node: EasyEmailProNode,
  p: EasyEmailProNode = page,
  contentWidth?: number,
) {
  return buildTopLevel(node, {
    resolve: contextFromPage(p),
    warnings: [],
    ...(contentWidth !== undefined ? { contentWidth } : {}),
  });
}

const divider = (width: string): EasyEmailProNode => ({
  type: "standard-divider",
  data: {},
  attributes: { width },
  children: [],
});

function dividerWidths(blocks: Block[]): Array<DividerBlock["width"]> {
  return (blocks as DividerBlock[]).map((block) => block.width);
}

const para = (text: string): EasyEmailProNode => ({
  type: "standard-paragraph",
  data: {},
  attributes: {},
  children: [{ text }],
});
const col = (
  children: EasyEmailProNode[],
  width?: string,
): EasyEmailProNode => ({
  type: "standard-column",
  data: {},
  attributes: width ? { width } : {},
  children,
});

describe("buildTopLevel", () => {
  it("builds a 1-col section from a single column", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: { "background-color": "#ffffff" },
      children: [col([para("Hi")])],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.type).toBe("section");
    expect(s.columns).toBe("1");
    expect(s.children).toHaveLength(1);
    expect(s.children[0][0].type).toBe("paragraph");
    expect(s.styles.backgroundColor).toBe("#ffffff");
    expect(
      entries.some(
        (e) => e.sourceTag === "standard-section" && e.status === "converted",
      ),
    ).toBe(true);
  });

  it("reads 50/50 as columns 2", () => {
    const { blocks } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [col([para("A")], "50%"), col([para("B")], "50%")],
    });
    expect((blocks[0] as SectionBlock).columns).toBe("2");
  });

  it("sets stackOnMobile false for a standard-group of columns", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-group",
          data: {},
          attributes: {},
          children: [
            col([para("A")], "33.33%"),
            col([para("B")], "33.33%"),
            col([para("C")], "33.34%"),
          ],
        },
      ],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("3");
    expect(s.stackOnMobile).toBe(false);
    expect(entries.some((e) => e.sourceTag === "standard-group")).toBe(false);
  });

  it("keeps 4 equal columns", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([para("a")], "25%"),
        col([para("b")], "25%"),
        col([para("c")], "25%"),
        col([para("d")], "25%"),
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.columns).toBe("4");
    expect(section.children).toHaveLength(4);
    expect(section.children.map((column) => column)).toHaveLength(4);
    expect(entries[0].status).toBe("converted");
  });

  it("folds 5 columns onto 4 and names the limit", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([para("a")], "20%"),
        col([para("b")], "20%"),
        col([para("c")], "20%"),
        col([para("d")], "20%"),
        col([para("e")], "20%"),
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.columns).toBe("4");
    expect(section.children).toHaveLength(4);
    expect(section.children[3]).toHaveLength(2);
    expect(entries[0].note).toBe(
      '5-column layout has no exact Templatical equivalent; folded onto "4". Templatical supports up to four columns.',
    );
  });

  it("snaps 20/60/20 to 1-2-1 and names the widths", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([para("a")], "20%"),
        col([para("b")], "60%"),
        col([para("c")], "20%"),
      ],
    });
    expect((blocks[0] as SectionBlock).columns).toBe("1-2-1");
    expect(entries[0].note).toBe(
      'Column widths 20%, 60%, 20% have no exact Templatical layout; resolved to "1-2-1".',
    );
  });

  it("names a column without a width as auto", () => {
    const { entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([para("a")], "15%"),
        col([para("b")]),
        col([para("c")], "15%"),
      ],
    });
    expect(entries[0].note).toMatch(
      /^Column widths 15%, auto, 15% have no exact Templatical layout;/,
    );
  });

  it("skips a placeholder-only column as an empty slot", () => {
    const { blocks } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([
          {
            type: "placeholder",
            data: {},
            attributes: {},
            children: [{ text: "" }],
          },
        ]),
      ],
    });
    expect((blocks[0] as SectionBlock).children[0]).toEqual([]);
  });

  it("uses page content-background-color when the section has no fill", () => {
    const p: EasyEmailProNode = {
      type: "page",
      data: {},
      attributes: { "content-background-color": "#263D29" },
      children: [],
    };
    const { blocks } = build(
      {
        type: "standard-section",
        data: {},
        attributes: {},
        children: [col([para("Hi")])],
      },
      p,
    );
    expect((blocks[0] as SectionBlock).styles.backgroundColor).toBe("#263D29");
  });

  it("folds wrapper paint onto the inner section", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-color": "#f5f5f5" },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {},
          children: [col([para("Hi")])],
        },
      ],
    });
    expect((blocks[0] as SectionBlock).wrapper?.backgroundColor).toBe(
      "#f5f5f5",
    );
    expect((blocks[0] as SectionBlock).wrapper?.fullWidth).toBeUndefined();
  });

  it("moves a full-width section colour onto the wrapper", () => {
    const { blocks } = build({
      type: "standard-section",
      data: {},
      attributes: {
        "full-width": "full-width",
        "background-color": "#111111",
      },
      children: [col([para("Hi")])],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      fullWidth: true,
    });
  });

  it("keeps the page content colour when a full-width section has only an image", () => {
    const p: EasyEmailProNode = {
      type: "page",
      data: {},
      attributes: { "content-background-color": "#263D29" },
      children: [],
    };
    const { blocks } = build(
      {
        type: "standard-section",
        data: {},
        attributes: {
          "full-width": "full-width",
          "background-url": "https://cdn.test/band.png",
        },
        children: [col([para("Hi")])],
      },
      p,
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#263D29");
    expect(section.backgroundImage).toBeUndefined();
    expect(section.wrapper?.fullWidth).toBe(true);
    expect(section.wrapper?.backgroundImage?.url).toBe(
      "https://cdn.test/band.png",
    );
    expect(section.wrapper?.backgroundColor).toBeUndefined();
  });

  it("restores a full-width section image inside a wrapper that is not full width", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-color": "#f5f5f5" },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {
            "full-width": "full-width",
            "background-url": "https://cdn.test/hero.png",
            "background-position": "center center",
          },
          children: [col([para("Hi")])],
        },
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.backgroundImage).toEqual({
      url: "https://cdn.test/hero.png",
      size: "auto",
      position: { x: "center", y: "center" },
      repeat: true,
    });
    expect(section.wrapper).toEqual({
      backgroundColor: "#f5f5f5",
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("restores a full-width section colour inside a wrapper that is not full width", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-color": "#f5f5f5" },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {
            "full-width": "full-width",
            "background-color": "#111111",
          },
          children: [col([para("Hi")])],
        },
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#111111");
    expect(section.wrapper).toEqual({
      backgroundColor: "#f5f5f5",
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  it("sets fullWidth on a full-width wrapper and keeps the section colour", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: {
        "full-width": "full-width",
        "background-color": "#222222",
      },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: { "background-color": "#ffffff" },
          children: [col([para("Hi")])],
        },
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.wrapper).toEqual({
      backgroundColor: "#222222",
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      fullWidth: true,
    });
  });

  it("keeps a full-width section band when its wrapper is full width and unpainted", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: {
        "full-width": "full-width",
        "padding-top": "8px",
        "padding-right": "8px",
        "padding-bottom": "8px",
        "padding-left": "8px",
      },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {
            "full-width": "full-width",
            "background-color": "#111111",
          },
          children: [col([para("Hi")])],
        },
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.wrapper?.backgroundColor).toBe("#111111");
    expect(section.wrapper?.fullWidth).toBe(true);
    expect(section.wrapper?.padding).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    });
  });

  it("keeps a full-width section image when its wrapper is full width and unpainted", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "full-width": "full-width" },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {
            "full-width": "full-width",
            "background-url": "https://cdn.test/hero.png",
            "background-position": "left top",
          },
          children: [col([para("Hi")])],
        },
      ],
    });
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.backgroundImage).toBeUndefined();
    expect(section.wrapper?.backgroundColor).toBeUndefined();
    expect(section.wrapper?.fullWidth).toBe(true);
    expect(section.wrapper?.backgroundImage).toEqual({
      url: "https://cdn.test/hero.png",
      size: "auto",
      position: { x: "left", y: "top" },
      repeat: true,
    });
  });

  it("leaves a full-width section that paints nothing of its own without a wrapper", () => {
    const painted: EasyEmailProNode = {
      type: "page",
      data: {},
      attributes: { "content-background-color": "#263D29" },
      children: [],
    };
    const { blocks } = build(
      {
        type: "standard-section",
        data: {},
        attributes: { "full-width": "full-width" },
        children: [col([para("Hi")])],
      },
      painted,
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#263D29");
    expect(section.backgroundImage).toBeUndefined();
    expect(section.wrapper).toBeUndefined();
  });

  it("walks hero children and maps background-url onto a hero background", () => {
    const { blocks, entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-color": "#000000",
        "background-url": "https://cdn.test/hero.png",
        mode: "fluid-height",
        "background-width": "1200px",
        "background-height": "800px",
        "vertical-align": "middle",
      },
      children: [
        {
          type: "standard-h1",
          data: {},
          attributes: {},
          children: [{ text: "Foods" }],
        },
      ],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("1");
    expect(s.children[0][0].type).toBe("title");
    expect(s.children[0].some((b) => b.type === "image")).toBe(false);
    expect(s.styles.backgroundColor).toBe("#000000");
    expect(s.hero).toEqual({ height: "image", verticalAlign: "middle" });
    expect(s.backgroundImage).toMatchObject({
      url: "https://cdn.test/hero.png",
      size: "cover",
      position: { x: "center", y: "center" },
      repeat: false,
      naturalWidth: 1200,
      naturalHeight: 800,
    });
    expect(entries[0]).toEqual({
      sourceTag: "standard-hero",
      templaticalBlockType: "section",
      status: "converted",
    });
  });

  it("maps a fixed-height hero to a fixed height", () => {
    const { blocks } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-url": "https://cdn.test/hero.png",
        mode: "fixed-height",
        height: "320px",
      },
      children: [],
    });
    expect((blocks[0] as SectionBlock).hero).toEqual({
      height: 320,
      verticalAlign: "top",
    });
  });

  it("gives a hero with no background-color mj-hero's white", () => {
    const { blocks } = build({
      type: "standard-hero",
      data: {},
      attributes: {},
      children: [],
    });
    expect((blocks[0] as SectionBlock).styles.backgroundColor).toBe("#ffffff");
  });

  it("leaves a hero with an explicit transparent background-color unfilled", () => {
    const { blocks } = build({
      type: "standard-hero",
      data: {},
      attributes: { "background-color": "transparent" },
      children: [],
    });
    expect((blocks[0] as SectionBlock).styles.backgroundColor).toBeUndefined();
  });

  it("takes the page content colour for a hero with no background-color", () => {
    const p: EasyEmailProNode = {
      type: "page",
      data: {},
      attributes: { "content-background-color": "#263D29" },
      children: [],
    };
    const { blocks } = build(
      {
        type: "standard-hero",
        data: {},
        attributes: {},
        children: [],
      },
      p,
    );
    expect((blocks[0] as SectionBlock).styles.backgroundColor).toBe("#263D29");
  });

  it("flattens a nested group inside a column", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [
        col([
          {
            type: "standard-group",
            data: {},
            attributes: {},
            children: [col([para("A")]), col([para("B")])],
          },
        ]),
      ],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("1");
    expect(s.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
    expect(
      entries.some(
        (e) => e.status === "approximated" && e.note?.includes("nested group"),
      ),
    ).toBe(true);
  });

  it("returns nothing for an unknown top-level type", () => {
    expect(
      build({
        type: "standard-paragraph",
        data: {},
        attributes: {},
        children: [{ text: "x" }],
      }),
    ).toEqual({ blocks: [], entries: [] });
  });

  it("skips an empty wrapper and approximates a multi-section band", () => {
    const empty = build({
      type: "standard-wrapper",
      data: {},
      attributes: {},
      children: [
        { type: "placeholder", data: {}, attributes: {}, children: [] },
      ],
    });
    expect(empty.blocks).toEqual([]);
    expect(empty.entries[0]).toMatchObject({
      sourceTag: "standard-wrapper",
      status: "skipped",
    });

    const two = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-color": "#eee", "border-radius": "8px" },
      children: [
        {
          type: "standard-section",
          data: {},
          attributes: {},
          children: [col([para("A")])],
        },
        {
          type: "standard-section",
          data: {},
          attributes: {},
          children: [col([para("B")])],
        },
      ],
    });
    expect(two.blocks).toHaveLength(2);
    expect(
      two.entries.filter((e) => e.templaticalBlockType === "section"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "approximated" }),
      ]),
    );
    expect((two.blocks[0] as SectionBlock).wrapper?.borderRadius).toBe(8);
  });

  it("keeps a hero without a background-url as a 1-col section", () => {
    const { blocks, entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {},
      children: [
        {
          type: "standard-h1",
          data: {},
          attributes: {},
          children: [{ text: "Hi" }],
        },
      ],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.children[0][0].type).toBe("title");
    expect(s.children[0].some((b) => b.type === "image")).toBe(false);
    expect(entries.some((e) => e.sourceTag === "standard-hero")).toBe(true);
  });

  it("flattens mixed columns and groups, and copies desktop-only visibility", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: { "border-radius": "4px" },
      children: [
        col([para("A")], "50%"),
        {
          type: "standard-group",
          data: {},
          attributes: {},
          children: [col([para("B")], "50%")],
        },
      ],
      visible: "desktop",
    } as EasyEmailProNode);
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("2");
    expect(s.visibility).toEqual({ desktop: true, mobile: false });
    expect(s.borderRadius).toBe(4);
    expect(
      entries.some(
        (e) => e.status === "approximated" && e.note?.includes("mixed columns"),
      ),
    ).toBe(true);
  });

  it("notes inexact same-count widths rather than a fold", () => {
    const { blocks, entries } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [col([para("A")], "40%"), col([para("B")], "60%")],
    });
    expect((blocks[0] as SectionBlock).columns).toBe("1-2");
    expect(
      entries.some(
        (e) =>
          e.status === "approximated" &&
          e.note?.includes("40%") &&
          e.note?.includes("resolved to"),
      ),
    ).toBe(true);
  });

  it("judges a px divider against its column's content width", () => {
    const { blocks } = build(
      {
        type: "standard-section",
        data: {},
        attributes: { "padding-left": "20px", "padding-right": "20px" },
        children: [
          col([divider("280px"), divider("279px")], "50%"),
          {
            type: "standard-column",
            data: {},
            attributes: { width: "50%", "padding-left": "10px" },
            children: [divider("270px"), divider("269px")],
          },
        ],
      },
      page,
      600,
    );
    const s = blocks[0] as SectionBlock;
    expect(dividerWidths(s.children[0])).toEqual(["full", 279]);
    expect(dividerWidths(s.children[1])).toEqual(["full", 269]);
  });

  it("narrows the width inside a standard-wrapper's padding", () => {
    const { blocks } = build(
      {
        type: "standard-wrapper",
        data: {},
        attributes: { "padding-left": "50px", "padding-right": "50px" },
        children: [
          {
            type: "standard-section",
            data: {},
            attributes: {},
            children: [col([divider("500px"), divider("499px")])],
          },
        ],
      },
      page,
      600,
    );
    const s = blocks[0] as SectionBlock;
    expect(dividerWidths(s.children[0])).toEqual(["full", 499]);
  });

  it("narrows the width inside a hero's padding", () => {
    const { blocks } = build(
      {
        type: "standard-hero",
        data: {},
        attributes: { "padding-left": "30px", "padding-right": "30px" },
        children: [divider("540px"), divider("539px")],
      },
      page,
      600,
    );
    const s = blocks[0] as SectionBlock;
    expect(dividerWidths(s.children[0])).toEqual(["full", 539]);
  });

  it("gives leftover non-column children the first slot's width", () => {
    const { blocks } = build(
      {
        type: "standard-section",
        data: {},
        attributes: {},
        children: [
          divider("300px"),
          divider("299px"),
          col([para("A")], "50%"),
          col([para("B")], "50%"),
        ],
      },
      page,
      600,
    );
    const s = blocks[0] as SectionBlock;
    expect(dividerWidths(s.children[0].slice(0, 2))).toEqual(["full", 299]);
  });

  it("drops leftover non-column children into the first slot", () => {
    const { blocks } = build({
      type: "standard-section",
      data: {},
      attributes: {},
      children: [para("Lead"), col([para("Col")])],
    });
    const s = blocks[0] as SectionBlock;
    expect(s.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });
});

describe("background images", () => {
  const section = (
    text: string,
    attributes: Record<string, unknown> = {},
  ): EasyEmailProNode => ({
    type: "standard-section",
    data: {},
    attributes,
    children: [col([para(text)])],
  });

  it("maps a section's background-url and longhands onto backgroundImage, converted", () => {
    const { blocks, entries } = build(
      section("Hi", {
        "background-url": "https://cdn.test/hero.jpg",
        "background-size": "cover",
        "background-position": "center top",
        "background-repeat": "no-repeat",
      }),
    );
    expect((blocks[0] as SectionBlock).backgroundImage).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: { x: "center", y: "top" },
      repeat: false,
    });
    expect(entries[0]).toEqual({
      sourceTag: "standard-section",
      templaticalBlockType: "section",
      status: "converted",
    });
  });

  it("reports a section size with no keyword as approximated", () => {
    const { entries } = build(
      section("Hi", { "background-url": "u", "background-size": "100%" }),
    );
    expect(entries[0]).toEqual({
      sourceTag: "standard-section",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Section background-size "100%" has no exact Templatical equivalent; imported as "cover".',
    });
  });

  it("maps a wrapper's image onto each section's wrapper, one copy each", () => {
    const { blocks } = build({
      type: "standard-wrapper",
      data: {},
      attributes: {
        "background-url": "https://cdn.test/band.png",
        "background-position": "left bottom",
      },
      children: [section("A"), section("B")],
    });
    const [a, b] = blocks as SectionBlock[];
    expect(a.wrapper?.backgroundImage).toEqual({
      url: "https://cdn.test/band.png",
      size: "auto",
      position: { x: "left", y: "bottom" },
      repeat: true,
    });
    expect(b.wrapper?.backgroundImage).toEqual(a.wrapper?.backgroundImage);
    expect(b.wrapper?.backgroundImage).not.toBe(a.wrapper?.backgroundImage);
  });

  it("appends a lossy wrapper value to the section entry", () => {
    const { entries } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-url": "u", "background-repeat": "repeat-x" },
      children: [section("A")],
    });
    expect(
      entries.filter((entry) => entry.templaticalBlockType === "section"),
    ).toEqual([
      {
        sourceTag: "standard-section",
        templaticalBlockType: "section",
        status: "approximated",
        note: 'Wrapper background-repeat "repeat-x" has no exact Templatical equivalent; imported as "repeat".',
      },
    ]);
  });

  it("quotes only 80 characters of a wrapper attribute in each section note", () => {
    const raw = "x".repeat(300);
    const { entries } = build({
      type: "standard-wrapper",
      data: {},
      attributes: { "background-url": "u", "background-size": raw },
      children: [section("A"), section("B"), section("C")],
    });
    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(3);
    for (const entry of sectionEntries) {
      expect(entry.status).toBe("approximated");
      expect(entry.note).toContain(
        `Wrapper background-size "${"x".repeat(80)}…"`,
      );
      expect(entry.note).not.toContain(raw);
    }
  });

  it("reads a hero with no mode or height as a regular section with a background image", () => {
    const { blocks } = build({
      type: "standard-hero",
      data: {},
      attributes: { "background-url": "https://cdn.test/hero.png" },
      children: [],
    });
    const hero = blocks[0] as SectionBlock;
    expect("hero" in hero).toBe(false);
    expect(hero.backgroundImage).toMatchObject({
      url: "https://cdn.test/hero.png",
      size: "cover",
      repeat: false,
    });
    expect(hero.children[0]).toEqual([]);
  });

  it("notes a fluid hero without an image size", () => {
    const { entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-url": "https://cdn.test/hero.png",
        mode: "fluid-height",
      },
      children: [],
    });
    expect(entries[0]).toMatchObject({
      status: "approximated",
      note: "Hero fluid-height has no background-width / background-height, so its image size is unknown; it renders as a regular section until it has a size or a fixed height.",
    });
  });

  it("notes an unknown mode and vertical-align", () => {
    const { blocks, entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-url": "https://cdn.test/hero.png",
        mode: "sideways",
        height: "300px",
        "vertical-align": "baseline",
      },
      children: [],
    });
    expect((blocks[0] as SectionBlock).hero).toEqual({
      height: 300,
      verticalAlign: "top",
    });
    expect(entries[0].note).toBe(
      'Hero vertical-align "baseline" has no Templatical equivalent; imported as "top". Hero mode "sideways" has no Templatical equivalent; imported as "fixed-height".',
    );
  });

  it("notes a hero with a height but no background-url", () => {
    const { blocks, entries } = build({
      type: "standard-hero",
      data: {},
      attributes: { mode: "fixed-height", height: "300px" },
      children: [],
    });
    expect((blocks[0] as SectionBlock).hero).toEqual({
      height: 300,
      verticalAlign: "top",
    });
    expect(entries[0].note).toBe(
      "Hero has no background-url, so it renders as a regular section until it has a background image.",
    );
  });

  it("drops inner-padding and inner-background-color with a note", () => {
    const { entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-url": "https://cdn.test/hero.png",
        mode: "fixed-height",
        height: "300px",
        "inner-padding": "10px",
        "inner-background-color": "#ffffff",
      },
      children: [],
    });
    expect(entries[0].note).toBe(
      'Hero inner-padding "10px" has no Templatical equivalent; dropped. Hero inner-background-color "#ffffff" has no Templatical equivalent; dropped.',
    );
  });
});
