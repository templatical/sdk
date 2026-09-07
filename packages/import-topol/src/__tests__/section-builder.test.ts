import { describe, expect, it } from "vitest";
import type { SectionBlock, SpacerBlock } from "@templatical/types";
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
    expect(matchColumnLayout([70, 50, null])).toEqual({
      layout: "3",
      exact: false,
    });
  });
  it("folds four columns to three", () => {
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "3",
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

  it("folds a fourth column's children into the third slot", () => {
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
    expect(s.columns).toBe("3");
    expect(s.children).toHaveLength(3);
    expect(s.children[2]).toHaveLength(2);
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      'Column widths 25%, 25%, 25%, 25% have no exact Templatical layout; resolved to "3".',
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
