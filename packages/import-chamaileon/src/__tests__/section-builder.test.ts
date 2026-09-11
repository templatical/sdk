import { describe, expect, it } from "vitest";
import type {
  DividerBlock,
  ImageBlock,
  ParagraphBlock,
  SectionBlock,
} from "@templatical/types";
import type { MapContext } from "../block-mapper";
import { buildFullwidth } from "../section-builder";
import type { ChamaileonNode, ImportReportEntry } from "../types";

const ctx = (): MapContext => ({
  bodyWidth: 600,
  columnWidth: 600,
  variables: [],
  warnings: [],
});

const text = (html: string): ChamaileonNode => ({
  type: "text",
  attrs: { text: html },
});

const column = (
  width: string,
  ...children: ChamaileonNode[]
): ChamaileonNode => ({
  type: "column",
  style: { width },
  children,
});

const multicolumn = (...columns: ChamaileonNode[]): ChamaileonNode => ({
  type: "multicolumn",
  children: columns,
});

const image = (src: string): ChamaileonNode => ({
  type: "image",
  attrs: { src, altText: "" },
  style: { width: "36px" },
});

const divider = (): ChamaileonNode => ({
  type: "divider",
  attrs: { lineStyle: "1px solid #cccccc" },
});

function build(node: ChamaileonNode): {
  blocks: ReturnType<typeof buildFullwidth>;
  entries: ImportReportEntry[];
} {
  const entries: ImportReportEntry[] = [];
  return { blocks: buildFullwidth(node, ctx(), entries), entries };
}

function sectionOf(node: ChamaileonNode): {
  section: SectionBlock;
  entries: ImportReportEntry[];
} {
  const { blocks, entries } = build(node);
  return { section: blocks[0] as SectionBlock, entries };
}

describe("buildFullwidth", () => {
  it("maps 300/300 columns to layout 2 as converted", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      style: {
        backgroundColor: "#f4f4f4",
        contentBackgroundColor: "#ffffff",
        contentPaddingTop: "12px",
        contentPaddingRight: "16px",
        contentPaddingBottom: "12px",
        contentPaddingLeft: "16px",
      },
      children: [
        multicolumn(
          column("300px", text("<p>Left</p>")),
          column("300px", text("<p>Right</p>")),
        ),
      ],
      placeholder: [{ type: "button", attrs: { text: "Library chrome" } }],
    });

    expect(section.type).toBe("section");
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children[0]).toHaveLength(1);
    expect(section.children[1]).toHaveLength(1);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "<p>Left</p>",
    );
    expect((section.children[1][0] as ParagraphBlock).content).toBe(
      "<p>Right</p>",
    );
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.styles.padding).toEqual({
      top: 12,
      right: 16,
      bottom: 12,
      left: 16,
    });
    expect(section.wrapper).toEqual({ backgroundColor: "#f4f4f4" });
    expect(section.children.flat().map((b) => b.type)).not.toContain("button");

    const entry = entries.find((e) => e.sourceTag === "fullwidth");
    expect(entry?.status).toBe("converted");
    expect(entry?.templaticalBlockType).toBe("section");
  });

  it("approximates 360/240 and notes the original px widths", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      children: [
        multicolumn(
          column("360px", text("<p>Wide</p>")),
          column("240px", text("<p>Narrow</p>")),
        ),
      ],
    });

    expect(section.columns).toBe("2-1");
    expect(section.children).toHaveLength(2);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "<p>Wide</p>",
    );
    expect((section.children[1][0] as ParagraphBlock).content).toBe(
      "<p>Narrow</p>",
    );
    expect("wrapper" in section).toBe(false);

    const entry = entries.find((e) => e.sourceTag === "fullwidth");
    expect(entry?.status).toBe("approximated");
    expect(entry?.note).toBe(
      'Column widths 360px, 240px have no exact Templatical layout; resolved to "2-1".',
    );
  });

  it("folds a 4-col row onto 3 and appends overflow onto the last slot", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      children: [
        multicolumn(
          column("150px", text("<p>1</p>")),
          column("150px", text("<p>2</p>")),
          column("150px", text("<p>3</p>")),
          column("150px", text("<p>4</p>")),
        ),
      ],
    });

    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children[0]).toHaveLength(1);
    expect(section.children[1]).toHaveLength(1);
    expect(section.children[2]).toHaveLength(2);
    expect(
      section.children[2].map((b) => (b as ParagraphBlock).content),
    ).toEqual(["<p>3</p>", "<p>4</p>"]);

    const entry = entries.find((e) => e.sourceTag === "fullwidth");
    expect(entry?.status).toBe("approximated");
    expect(entry?.note).toBe(
      'Column widths 150px, 150px, 150px, 150px have no exact Templatical layout; resolved to "3".',
    );
  });

  it("flattens a nested 3-col into the parent column with no nested section", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      children: [
        multicolumn(
          column(
            "300px",
            multicolumn(
              column("100px", image("https://cdn.test/a.png")),
              column("100px", image("https://cdn.test/b.png")),
              column("100px", image("https://cdn.test/c.png")),
            ),
          ),
          column("300px", text("<p>Side</p>")),
        ),
      ],
    });

    expect(section.columns).toBe("2");
    expect(section.children[0].map((b) => b.type)).toEqual([
      "image",
      "image",
      "image",
    ]);
    expect((section.children[0] as ImageBlock[]).map((b) => b.src)).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
    expect((section.children[1][0] as ParagraphBlock).content).toBe(
      "<p>Side</p>",
    );
    expect(section.children.flat().map((b) => b.type)).not.toContain("section");

    const nested = entries.find(
      (e) => e.note === "nested multicolumn flattened (3 columns)",
    );
    expect(nested?.status).toBe("approximated");
    expect(nested?.sourceTag).toBe("multicolumn");
    expect(nested?.templaticalBlockType).toBeNull();
  });

  it("silently flattens a transparent box", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      children: [
        {
          type: "box",
          style: {
            backgroundColor: null,
            paddingTop: "0px",
            paddingRight: "0px",
            paddingBottom: "0px",
            paddingLeft: "0px",
            borderRadius: "0px",
          },
          children: [text("<p>Inside</p>")],
        },
      ],
    });

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0]).toHaveLength(1);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "<p>Inside</p>",
    );
    expect(entries.filter((e) => e.sourceTag === "box")).toEqual([]);
    expect(entries.find((e) => e.sourceTag === "fullwidth")?.status).toBe(
      "converted",
    );
  });

  it("copies a sole painted box fill onto the section", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      style: { contentBackgroundColor: null },
      children: [
        {
          type: "box",
          style: { backgroundColor: "#FF6600" },
          children: [text("<p>Card</p>")],
        },
      ],
    });

    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#ff6600");
    expect("wrapper" in section).toBe(false);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "<p>Card</p>",
    );
    expect(entries.filter((e) => e.sourceTag === "box")).toEqual([]);
    expect(entries.find((e) => e.sourceTag === "fullwidth")?.status).toBe(
      "converted",
    );
  });

  it("approximates a mixed fullwidth and puts the sibling divider in column 0", () => {
    const { section, entries } = sectionOf({
      type: "fullwidth",
      children: [
        {
          type: "box",
          style: { backgroundColor: null },
          children: [text("<p>Intro</p>")],
        },
        multicolumn(
          column("300px", text("<p>A</p>")),
          column("300px", text("<p>B</p>")),
        ),
        divider(),
      ],
    });

    expect(section.columns).toBe("2");
    expect(section.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "divider",
    ]);
    expect((section.children[0][0] as ParagraphBlock).content).toBe(
      "<p>Intro</p>",
    );
    expect((section.children[0][1] as ParagraphBlock).content).toBe("<p>A</p>");
    expect((section.children[0][2] as DividerBlock).width).toBe("full");
    expect((section.children[1][0] as ParagraphBlock).content).toBe("<p>B</p>");

    const entry = entries.find((e) => e.sourceTag === "fullwidth");
    expect(entry?.status).toBe("approximated");
    expect(entry?.note).toBe(
      "fullwidth mixes a multicolumn with sibling leaves; siblings were placed in column 0.",
    );
    expect(entries.filter((e) => e.sourceTag === "box")).toEqual([]);
  });
});
