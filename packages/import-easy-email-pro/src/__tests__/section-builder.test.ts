import { describe, expect, it } from "vitest";
import { buildTopLevel } from "../section-builder";
import { contextFromPage } from "../normalize";
import type { EasyEmailProNode } from "../types";
import type { SectionBlock } from "@templatical/types";

const page: EasyEmailProNode = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};
function build(node: EasyEmailProNode, p: EasyEmailProNode = page) {
  return buildTopLevel(node, { resolve: contextFromPage(p), warnings: [] });
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

  it("folds 4 columns to 3 and approximates", () => {
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
    expect((blocks[0] as SectionBlock).columns).toBe("3");
    expect((blocks[0] as SectionBlock).children[2]).toHaveLength(2);
    expect(
      entries.some((e) => e.status === "approximated" && e.note?.includes("4")),
    ).toBe(true);
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
  });

  it("walks hero children and prepends background-url as an image", () => {
    const { blocks, entries } = build({
      type: "standard-hero",
      data: {},
      attributes: {
        "background-color": "#000000",
        "background-url": "https://cdn.test/hero.png",
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
    expect(s.children[0][0].type).toBe("image");
    expect(s.children[0][1].type).toBe("title");
    expect(s.styles.backgroundColor).toBe("#000000");
    expect(
      entries.some(
        (e) => e.sourceTag === "standard-hero" && e.status === "approximated",
      ),
    ).toBe(true);
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
});
