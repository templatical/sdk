import { describe, expect, it } from "vitest";
import type { ImageBlock, SectionBlock, SpacerBlock } from "@templatical/types";
import { buildSection, matchColumnLayout } from "../section-builder";
import { readGlobalStyle } from "../global-style";
import type { MapContext } from "../block-mapper";
import type { ImportReportEntry, TopolNode } from "../types";

function ctx(): MapContext {
  return {
    style: readGlobalStyle(
      { tagName: "mj-global-style", attributes: {} } as never,
      undefined,
      [],
    ),
    columnWidth: 600,
  };
}

const column = (width: string | null, ...children: TopolNode[]): TopolNode =>
  ({
    tagName: "mj-column",
    attributes: width === null ? {} : { width },
    children,
  }) as TopolNode;

const spacer = (height: number): TopolNode =>
  ({ tagName: "mj-spacer", attributes: { height } }) as TopolNode;

const image = (width: number): TopolNode =>
  ({
    tagName: "mj-image",
    attributes: { src: "https://cdn.test/a.png", alt: "", width },
  }) as TopolNode;

const section = (
  attributes: Record<string, unknown>,
  ...children: TopolNode[]
): TopolNode => ({ tagName: "mj-section", attributes, children }) as TopolNode;

function build(node: TopolNode) {
  const entries: ImportReportEntry[] = [];
  return { blocks: buildSection(node, ctx(), entries), entries };
}

describe("matchColumnLayout", () => {
  it("matches one full-width column", () => {
    expect(matchColumnLayout([100])).toEqual({ layout: "1", exact: true });
  });
  it("matches an even split", () => {
    expect(matchColumnLayout([50, 50])).toEqual({ layout: "2", exact: true });
  });
  it("matches thirds", () => {
    expect(matchColumnLayout([33.33, 33.33, 33.34])).toEqual({
      layout: "3",
      exact: true,
    });
  });
  it("matches a narrow-then-wide split", () => {
    expect(matchColumnLayout([33.33, 66.67])).toEqual({
      layout: "1-2",
      exact: true,
    });
  });
  it("tolerates two points of drift", () => {
    expect(matchColumnLayout([34, 66])).toEqual({ layout: "1-2", exact: true });
  });
  it("distributes the remainder to an unset column", () => {
    expect(matchColumnLayout([70, null])).toEqual({
      layout: "2-1",
      exact: false,
    });
  });
  it("distributes the remainder in the mirrored direction", () => {
    expect(matchColumnLayout([null, 70])).toEqual({
      layout: "1-2",
      exact: false,
    });
  });
  it("treats an all-unset pair as an even split", () => {
    expect(matchColumnLayout([null, null])).toEqual({
      layout: "2",
      exact: true,
    });
  });
  it("clamps a remainder that would go negative", () => {
    // 70 + 50 already pass 100, so the unset column is 0. That shape is
    // nearer 25/50/25 than equal thirds.
    expect(matchColumnLayout([70, 50, null])).toEqual({
      layout: "1-2-1",
      exact: false,
    });
  });
  it("matches the four new layouts exactly", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "4",
      exact: true,
    });
    expect(matchColumnLayout([25, 75])).toEqual({ layout: "1-3", exact: true });
    expect(matchColumnLayout([75, 25])).toEqual({ layout: "3-1", exact: true });
    expect(matchColumnLayout([25, 50, 25])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
  });

  it("snaps 20/60/20 to 1-2-1, the nearer three-column layout", () => {
    expect(matchColumnLayout([20, 60, 20])).toEqual({
      layout: "1-2-1",
      exact: false,
    });
  });

  it("folds five columns onto 4", () => {
    expect(matchColumnLayout([20, 20, 20, 20, 20])).toEqual({
      layout: "4",
      exact: false,
    });
  });

  it("treats four unset columns as an exact 4", () => {
    expect(matchColumnLayout([null, null, null, null])).toEqual({
      layout: "4",
      exact: true,
    });
  });

  it("folds five unset columns onto 4", () => {
    expect(matchColumnLayout([null, null, null, null, null])).toEqual({
      layout: "4",
      exact: false,
    });
  });
});

describe("buildSection", () => {
  it("builds a one-column section with its children", () => {
    const { blocks, entries } = build(
      section(
        { "background-color": "#eeeeee", padding: "20px" },
        column("100%", spacer(8)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.type).toBe("section");
    expect(s.columns).toBe("1");
    expect(s.styles.backgroundColor).toBe("#eeeeee");
    expect(s.styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    });
    expect(s.children[0]).toHaveLength(1);
    expect((s.children[0][0] as SpacerBlock).height).toBe(8);
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
    ]);
  });

  it("moves a full-width section background onto the wrapper", () => {
    const { blocks, entries } = build(
      section(
        { "background-color": "#111111", "full-width": "full-width" },
        column("100%", spacer(8)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.styles.backgroundColor).toBeUndefined();
    expect(s.wrapper).toEqual({
      backgroundColor: "#111111",
      fullWidth: true,
    });
    expect(entries[0].status).toBe("converted");
  });

  it("moves a full-width section image onto the wrapper", () => {
    const { blocks } = build(
      section(
        {
          "full-width": "full-width",
          "background-url": "https://cdn.test/band.jpg",
          "background-size": "cover",
          "background-position": "center center",
          "background-repeat": "no-repeat",
        },
        column("100%"),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.backgroundImage).toBeUndefined();
    expect(s.wrapper).toEqual({
      backgroundImage: {
        url: "https://cdn.test/band.jpg",
        size: "cover",
        position: { x: "center", y: "center" },
        repeat: false,
      },
      fullWidth: true,
    });
  });

  it("leaves a full-width section with no background unwrapped", () => {
    const s = build(section({ "full-width": "full-width" }, column("100%")))
      .blocks[0] as SectionBlock;
    expect(s.styles.backgroundColor).toBeUndefined();
    expect(s.wrapper).toBeUndefined();
  });

  it("keeps a section background on the section when it is not full width", () => {
    const s = build(section({ "background-color": "#eeeeee" }, column("100%")))
      .blocks[0] as SectionBlock;
    expect(s.styles.backgroundColor).toBe("#eeeeee");
    expect(s.wrapper).toBeUndefined();
  });

  it("ignores the stale camelCase styling keys", () => {
    const node = section(
      { "background-color": "#eeeeee", padding: "9px 0px 9px 0px" },
      column("100%"),
    );
    (node as Record<string, unknown>).backgroundColor = null;
    (node as Record<string, unknown>).paddingTop = 0;
    const s = build(node).blocks[0] as SectionBlock;
    expect(s.styles.backgroundColor).toBe("#eeeeee");
    expect(s.styles.padding).toEqual({ top: 9, right: 0, bottom: 9, left: 0 });
  });

  it("emits no entry for a column itself", () => {
    const { entries } = build(section({}, column("50%"), column("50%")));
    expect(entries.filter((e) => e.sourceTag === "mj-column")).toEqual([]);
  });

  it("puts the section's own entry before its children's, in document order", () => {
    const { entries } = build(
      section({}, column("50%", spacer(1)), column("50%", spacer(2))),
    );
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
      "mj-spacer",
    ]);
  });

  it("keeps four equal columns in four slots", () => {
    const { blocks, entries } = build(
      section(
        {},
        column("25%", spacer(1)),
        column("25%", spacer(2)),
        column("25%", spacer(3)),
        column("25%", spacer(4)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("4");
    expect(s.children).toHaveLength(4);
    expect(
      s.children.map((column) => (column[0] as SpacerBlock).height),
    ).toEqual([1, 2, 3, 4]);
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    expect(entry.status).toBe("converted");
    expect(entry.note).toBeUndefined();
  });

  it("folds a fifth column into the fourth slot and names the limit", () => {
    const { blocks, entries } = build(
      section(
        {},
        column("20%", spacer(1)),
        column("20%", spacer(2)),
        column("20%", spacer(3)),
        column("20%", spacer(4)),
        column("20%", spacer(5)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("4");
    expect(s.children).toHaveLength(4);
    expect(s.children[3]).toHaveLength(2);
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      'Column widths 20%, 20%, 20%, 20%, 20% have no exact Templatical layout; resolved to "4". Templatical supports up to four columns.',
    );
  });

  it("sizes a 1-3 row at a quarter and three quarters of the 600px body", () => {
    const { blocks, entries } = build(
      section(
        {},
        column("25%", image(150), image(149)),
        column("75%", image(450), image(449)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("1-3");
    expect(s.children[0].map((block) => (block as ImageBlock).width)).toEqual([
      "full",
      149,
    ]);
    expect(s.children[1].map((block) => (block as ImageBlock).width)).toEqual([
      "full",
      449,
    ]);
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    expect(entry.status).toBe("converted");
    expect(entry.note).toBeUndefined();
  });

  it("sizes a 3-1 row at three quarters and a quarter of the 600px body", () => {
    const { blocks } = build(
      section(
        {},
        column("75%", image(450), image(449)),
        column("25%", image(150), image(149)),
      ),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("3-1");
    expect(s.children[0].map((block) => (block as ImageBlock).width)).toEqual([
      "full",
      449,
    ]);
    expect(s.children[1].map((block) => (block as ImageBlock).width)).toEqual([
      "full",
      149,
    ]);
  });

  it("names a 20/60/20 snap to 1-2-1", () => {
    const { blocks, entries } = build(
      section({}, column("20%", spacer(1)), column("60%"), column("20%")),
    );
    const s = blocks[0] as SectionBlock;
    expect(s.columns).toBe("1-2-1");
    expect(s.children).toHaveLength(3);
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    expect(entry.note).toBe(
      'Column widths 20%, 60%, 20% have no exact Templatical layout; resolved to "1-2-1".',
    );
  });

  it("routes an mj-social child through the social mapper", () => {
    const { blocks } = build(
      section(
        {},
        column("100%", {
          tagName: "mj-social",
          attributes: {
            display: "facebook:url",
            "facebook-href": "https://fb.test/a",
          },
        } as TopolNode),
      ),
    );
    expect((blocks[0] as SectionBlock).children[0][0].type).toBe("social");
  });

  it("returns no section when it holds no columns", () => {
    expect(build(section({})).blocks).toEqual([]);
  });
});

describe("buildSection background image", () => {
  it("maps background-url and its longhands onto backgroundImage, converted", () => {
    const { blocks, entries } = build(
      section(
        {
          "background-url": "https://cdn.test/hero.jpg",
          "background-size": "cover",
          "background-position": "center top",
          "background-repeat": "no-repeat",
        },
        column("100%", spacer(8)),
      ),
    );
    expect((blocks[0] as SectionBlock).backgroundImage).toEqual({
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: { x: "center", y: "top" },
      repeat: false,
    });
    expect(entries[0]).toEqual({
      sourceTag: "mj-section",
      templaticalBlockType: "section",
      status: "converted",
    });
  });

  it("reads Topol's null as unset", () => {
    const { blocks } = build(
      section(
        { "background-url": null, "background-size": "cover" },
        column("100%", spacer(8)),
      ),
    );
    expect("backgroundImage" in blocks[0]).toBe(false);
  });

  it("joins a background note to the column-width note", () => {
    const { entries } = build(
      section(
        { "background-url": "u", "background-size": "50%" },
        column("40%", spacer(8)),
        column("60%", spacer(8)),
      ),
    );
    expect(entries[0]).toEqual({
      sourceTag: "mj-section",
      templaticalBlockType: "section",
      status: "approximated",
      note:
        'Column widths 40%, 60% have no exact Templatical layout; resolved to "1-2". ' +
        'Section background-size "50%" has no exact Templatical equivalent; imported as "auto".',
    });
  });
});
