import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type { SectionBlock } from "@templatical/types";
import { buildAttributeCascade, findByTag } from "../attribute-resolver";
import {
  buildSection,
  buildWrapper,
  matchColumnLayout,
} from "../section-builder";
import type { ConvertContext } from "../block-base";
import type { ImportReportEntry } from "../types";

function build(markup: string, which: "section" | "wrapper" = "section") {
  const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
    xml: { xmlMode: false, recognizeSelfClosing: true },
  });
  const ctx: ConvertContext = {
    $,
    cascade: buildAttributeCascade($),
    containerWidth: 600,
    contentWidth: 600,
    columnPadding: 0,
    direction: "ltr",
    warnings: [],
  };
  const entries: ImportReportEntry[] = [];
  const $el = findByTag(
    $,
    which === "section" ? "mj-section" : "mj-wrapper",
  ).first() as unknown as Cheerio<Element>;
  const blocks =
    which === "section"
      ? buildSection($el, ctx, entries)
      : buildWrapper($el, ctx, entries);
  return { blocks, entries, ctx };
}

describe("matchColumnLayout", () => {
  it("matches a single full-width column", () => {
    expect(matchColumnLayout([100])).toEqual({ layout: "1", exact: true });
  });

  it("keeps one column on layout 1 when the width is not 100%", () => {
    expect(matchColumnLayout([50])).toEqual({ layout: "1", exact: false });
  });

  it("approximates a two-column row whose shares cannot be stored", () => {
    expect(matchColumnLayout([100, 0])).toEqual({ layout: "2", exact: false });
  });

  it("keeps a positive non-preset ratio exact, with columnWidths", () => {
    expect(matchColumnLayout([30, 70])).toEqual({
      layout: "2",
      exact: true,
      columnWidths: [30, 70],
    });
    expect(matchColumnLayout([25, 25, 50])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [25, 25, 50],
    });
    expect(matchColumnLayout([20, 20, 20, 40])).toEqual({
      layout: "4",
      exact: true,
      columnWidths: [20, 20, 20, 40],
    });
  });

  it("matches an even two-column split", () => {
    expect(matchColumnLayout([50, 50])).toEqual({ layout: "2", exact: true });
  });

  it("matches the renderer's three-column widths, rounding gap included", () => {
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

  it("matches a wide-then-narrow split", () => {
    expect(matchColumnLayout([66.67, 33.33])).toEqual({
      layout: "2-1",
      exact: true,
    });
  });

  it("tolerates two points of drift in hand-written widths", () => {
    expect(matchColumnLayout([34, 66])).toEqual({ layout: "1-2", exact: true });
  });

  it("distributes equally when no widths are given", () => {
    expect(matchColumnLayout([null, null])).toEqual({
      layout: "2",
      exact: true,
    });
  });

  it("gives an absent column MJML's default share, then scales because 70 and 50 are not 100", () => {
    // MJML's default is the parent divided by the column count: 50, not the
    // 30 the stated 70 leaves over. 70 + 50 is 120, so the stored shares are
    // scaled and the match is not exact.
    expect(matchColumnLayout([70, null])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [58.33, 41.67],
    });
  });

  it("gives a leading absent column the same default share", () => {
    expect(matchColumnLayout([null, 70])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [41.67, 58.33],
    });
  });

  it("gives each absent column the default share, not a split of the remainder", () => {
    // 100 / 3 beside the stated 50. The row is not a preset and does not
    // total 100, so the even layout keeps the scaled shares and is not exact.
    expect(matchColumnLayout([50, null, null])).toEqual({
      layout: "3",
      exact: false,
      columnWidths: [42.86, 28.57, 28.57],
    });
  });

  it("scales 30 beside an absent column from the 30/50 MJML shares", () => {
    expect(matchColumnLayout([30, null])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [37.5, 62.5],
    });
  });

  it("approximates stated shares that do not total 100 and keeps 30/70 exact", () => {
    expect(matchColumnLayout([30, 40])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [42.86, 57.14],
    });
    expect(matchColumnLayout([30, 70])).toEqual({
      layout: "2",
      exact: true,
      columnWidths: [30, 70],
    });
  });

  it("matches 25/75, 75/25, 25/50/25 and four quarters exactly", () => {
    expect(matchColumnLayout([25, 75])).toEqual({
      layout: "1-3",
      exact: true,
    });
    expect(matchColumnLayout([75, 25])).toEqual({
      layout: "3-1",
      exact: true,
    });
    expect(matchColumnLayout([25, 50, 25])).toEqual({
      layout: "1-2-1",
      exact: true,
    });
    expect(matchColumnLayout([25, 25, 25, 25])).toEqual({
      layout: "4",
      exact: true,
    });
  });

  it("keeps 20/60/20 as custom widths on the even layout", () => {
    expect(matchColumnLayout([20, 60, 20])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [20, 60, 20],
    });
  });

  it("keeps a three-column ratio outside the tolerance as custom widths", () => {
    expect(matchColumnLayout([20, 20, 60])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [20, 20, 60],
    });
  });

  it("imports 25/25/50, 50/33.33/16.67 and 30/70 as columnWidths", () => {
    expect(matchColumnLayout([25, 25, 50])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [25, 25, 50],
    });
    expect(matchColumnLayout([50, 33.33, 16.67])).toEqual({
      layout: "3",
      exact: true,
      columnWidths: [50, 33.33, 16.67],
    });
    expect(matchColumnLayout([30, 70])).toEqual({
      layout: "2",
      exact: true,
      columnWidths: [30, 70],
    });
  });

  it("keeps 33.33/66.67 on 1-2 and 49/51 on the even split", () => {
    expect(matchColumnLayout([33.33, 66.67])).toEqual({
      layout: "1-2",
      exact: true,
    });
    expect(matchColumnLayout([49, 51])).toEqual({
      layout: "2",
      exact: true,
    });
  });

  it("keeps the preset that scaled widths land on, without columnWidths", () => {
    // 45 / 45 and 30 / 60 total 90, so they are scaled to 100 and the
    // match stays approximated, but 50 / 50 and 33.33 / 66.67 are presets.
    expect(matchColumnLayout([45, 45])).toEqual({ layout: "2", exact: false });
    expect(matchColumnLayout([30, 60])).toEqual({
      layout: "1-2",
      exact: false,
    });
    expect(matchColumnLayout([60, 20])).toEqual({
      layout: "3-1",
      exact: false,
    });
    expect(matchColumnLayout([20, 40, 20])).toEqual({
      layout: "1-2-1",
      exact: false,
    });
    expect(matchColumnLayout([20, 20, 20, 20])).toEqual({
      layout: "4",
      exact: false,
    });
  });

  it("matches scaled thirds whose rounding puts the spare hundredth on another column", () => {
    // Thirds of 100 round to 33.34 / 33.33 / 33.33; the preset keeps the
    // spare hundredth on the last column instead.
    expect(matchColumnLayout([30, 30, 30])).toEqual({
      layout: "3",
      exact: false,
    });
  });

  it("allows one hundredth between scaled shares and a preset, and no more", () => {
    // 45.01 / 44.99 scales to 50.01 / 49.99; 45.02 / 44.98 to 50.02 / 49.98.
    expect(matchColumnLayout([45.01, 44.99])).toEqual({
      layout: "2",
      exact: false,
    });
    expect(matchColumnLayout([45.02, 44.98])).toEqual({
      layout: "2",
      exact: false,
      columnWidths: [50.02, 49.98],
    });
  });

  it("folds five columns onto 4", () => {
    expect(matchColumnLayout([20, 20, 20, 20, 20])).toEqual({
      layout: "4",
      exact: false,
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
  it("approximates a one-column section whose width is not 100%", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="50%"><mj-text>Hi</mj-text></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("1");
    expect(section.columnWidths).toBeUndefined();
    expect(section.children).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceTag: "mj-section",
      status: "approximated",
      note: 'Column widths 50% have no exact Templatical layout; resolved to "1".',
    });
  });

  it("approximates a row whose shares cannot be stored as columnWidths", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="100%"><mj-text>A</mj-text></mj-column><mj-column width="0%"><mj-text>B</mj-text></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("2");
    expect(section.columnWidths).toBeUndefined();
    expect(section.children).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      sourceTag: "mj-section",
      status: "approximated",
      note: 'Column widths 100%, 0% have no exact Templatical layout; resolved to "2".',
    });
  });

  it("imports widths that scale onto a preset as that preset, approximated", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="45%"><mj-text>A</mj-text></mj-column><mj-column width="45%"><mj-text>B</mj-text></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("2");
    expect(section.columnWidths).toBeUndefined();
    expect(section.children).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      sourceTag: "mj-section",
      status: "approximated",
      note: 'Column widths 45%, 45% have no exact Templatical layout; resolved to "2".',
    });
  });

  it("names px widths that scale onto 1-2 as written", () => {
    // 180px and 360px of the 600px inner box are 30 / 60, scaled to 1-2.
    const { blocks, entries } = build(
      '<mj-section><mj-column width="180px"><mj-text>A</mj-text></mj-column><mj-column width="360px"><mj-text>B</mj-text></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("1-2");
    expect(section.columnWidths).toBeUndefined();
    expect(entries[0]).toMatchObject({
      sourceTag: "mj-section",
      status: "approximated",
      note: 'Column widths 180px, 360px have no exact Templatical layout; resolved to "1-2".',
    });
  });

  it("builds a one-column section with its children", () => {
    const { blocks, entries } = build(
      '<mj-section background-color="#eeeeee" padding="20px"><mj-column><mj-spacer height="8px" /></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(blocks).toHaveLength(1);
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#eeeeee");
    expect(section.styles.padding).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    });
    expect(section.children).toHaveLength(1);
    expect(section.children[0]).toHaveLength(1);
    expect(section.children[0][0].type).toBe("spacer");
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
    ]);
  });

  it("emits no entry for mj-column itself", () => {
    const { entries } = build(
      "<mj-section><mj-column /><mj-column /></mj-section>",
    );
    expect(entries.filter((e) => e.sourceTag === "mj-column")).toEqual([]);
  });

  it("reads border radius", () => {
    const { blocks } = build(
      '<mj-section border-radius="12px"><mj-column /></mj-section>',
    );
    expect((blocks[0] as SectionBlock).borderRadius).toBe(12);
  });

  it("omits borderRadius when the attribute is absent", () => {
    const { blocks } = build("<mj-section><mj-column /></mj-section>");
    expect("borderRadius" in blocks[0]).toBe(false);
  });

  it("reads a per-corner border radius", () => {
    const { blocks, entries } = build(
      '<mj-section border-radius="12px 12px 0px 0px"><mj-column /></mj-section>',
    );
    expect((blocks[0] as SectionBlock).borderRadius).toEqual({
      topLeft: 12,
      topRight: 12,
      bottomRight: 0,
      bottomLeft: 0,
    });
    expect(entries[0].status).toBe("converted");
  });

  it("reads a border radius it cannot read as square corners and reports it approximated", () => {
    const { blocks, entries } = build(
      '<mj-section border-radius="5%"><mj-column /></mj-section>',
    );
    expect("borderRadius" in blocks[0]).toBe(false);
    expect(entries[0]).toEqual({
      sourceTag: "mj-section",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Section border-radius "5%" could not be read; imported as square corners.',
    });
  });

  it("reads its border, each border-<side> overriding border", () => {
    const { blocks, entries } = build(
      '<mj-section border="1px solid #cccccc" border-bottom="4px dashed #ff0000"><mj-column /></mj-section>',
    );
    const side = { width: 1, style: "solid", color: "#cccccc" };
    expect((blocks[0] as SectionBlock).border).toEqual({
      top: side,
      right: side,
      bottom: { width: 4, style: "dashed", color: "#ff0000" },
      left: side,
    });
    expect(entries[0].status).toBe("converted");
  });

  it("omits border when the attribute is absent", () => {
    const { blocks } = build("<mj-section><mj-column /></mj-section>");
    expect("border" in blocks[0]).toBe(false);
  });

  it("keeps a border note and stores 40/60 as column widths", () => {
    const { blocks, entries } = build(
      '<mj-section border="2px inset #000000"><mj-column width="40%" /><mj-column width="60%" /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    expect(section.columns).toBe("2");
    expect(section.columnWidths).toEqual([40, 60]);
    expect(entries[0]).toEqual({
      sourceTag: "mj-section",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Section border "2px inset #000000" uses style inset; imported as solid.',
    });
  });

  it("reads stackOnMobile false from an mj-group", () => {
    const { blocks } = build(
      '<mj-section><mj-group><mj-column width="50%" /><mj-column width="50%" /></mj-group></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.stackOnMobile).toBe(false);
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
  });

  it("keeps every column when a section mixes a direct column with a group", () => {
    const { blocks } = build(`
      <mj-section>
        <mj-column><mj-spacer height="1px" /></mj-column>
        <mj-group>
          <mj-column><mj-spacer height="2px" /></mj-column>
          <mj-column><mj-spacer height="3px" /></mj-column>
        </mj-group>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;

    expect(section.stackOnMobile).toBe(false);
    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children[0][0]).toMatchObject({
      type: "spacer",
      height: 1,
    });
    expect(section.children[1][0]).toMatchObject({
      type: "spacer",
      height: 2,
    });
    expect(section.children[2][0]).toMatchObject({
      type: "spacer",
      height: 3,
    });
  });

  it("keeps every column across two groups in the same section", () => {
    const { blocks } = build(`
      <mj-section>
        <mj-group>
          <mj-column><mj-spacer height="1px" /></mj-column>
          <mj-column><mj-spacer height="2px" /></mj-column>
        </mj-group>
        <mj-group>
          <mj-column><mj-spacer height="3px" /></mj-column>
        </mj-group>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;

    expect(section.stackOnMobile).toBe(false);
    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children[0][0]).toMatchObject({
      type: "spacer",
      height: 1,
    });
    expect(section.children[1][0]).toMatchObject({
      type: "spacer",
      height: 2,
    });
    expect(section.children[2][0]).toMatchObject({
      type: "spacer",
      height: 3,
    });
  });

  it("preserves document order when a group sits between two direct columns", () => {
    const { blocks } = build(`
      <mj-section>
        <mj-column><mj-spacer height="1px" /></mj-column>
        <mj-group>
          <mj-column><mj-spacer height="2px" /></mj-column>
        </mj-group>
        <mj-column><mj-spacer height="3px" /></mj-column>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;

    expect(section.stackOnMobile).toBe(false);
    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children[0][0]).toMatchObject({
      type: "spacer",
      height: 1,
    });
    expect(section.children[1][0]).toMatchObject({
      type: "spacer",
      height: 2,
    });
    expect(section.children[2][0]).toMatchObject({
      type: "spacer",
      height: 3,
    });
  });

  it("omits stackOnMobile when there is no mj-group", () => {
    const { blocks } = build("<mj-section><mj-column /></mj-section>");
    expect("stackOnMobile" in blocks[0]).toBe(false);
  });

  it("sizes a 3-1 row at three quarters and a quarter of the 600px body", () => {
    const { blocks, entries } = build(`
      <mj-section>
        <mj-column width="75%">
          <mj-divider width="450px" />
          <mj-divider width="449px" />
        </mj-column>
        <mj-column width="25%">
          <mj-divider width="150px" />
          <mj-divider width="149px" />
        </mj-column>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    expect(section.columns).toBe("3-1");
    expect(
      section.children[0].map((block) =>
        block.type === "divider" ? block.width : null,
      ),
    ).toEqual(["full", 449]);
    expect(
      section.children[1].map((block) =>
        block.type === "divider" ? block.width : null,
      ),
    ).toEqual(["full", 149]);
    expect(entry.status).toBe("converted");
    expect(entry.note).toBeUndefined();
  });

  it("reads 25/75 as 1-3 with nothing lost", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="25%" /><mj-column width="75%" /></mj-section>',
    );
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("1-3");
    expect(section.children).toHaveLength(2);
    expect(entry.status).toBe("converted");
    expect(entry.note).toBeUndefined();
  });

  it("stores 20/60/20 as column widths on the even layout", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="20%" /><mj-column width="60%" /><mj-column width="20%" /></mj-section>',
    );
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;
    const section = blocks[0] as SectionBlock;

    expect(section.columns).toBe("3");
    expect(section.columnWidths).toEqual([20, 60, 20]);
    expect(entry.status).toBe("converted");
    expect(entry.note).toBeUndefined();
  });

  it("stores 25/25/50 and 50/33.33/16.67 on the section", () => {
    const quarters = build(
      '<mj-section><mj-column width="25%" /><mj-column width="25%" /><mj-column width="50%" /></mj-section>',
    );
    const uneven = build(
      '<mj-section><mj-column width="50%" /><mj-column width="33.33%" /><mj-column width="16.67%" /></mj-section>',
    );
    const split = build(
      '<mj-section><mj-column width="30%" /><mj-column width="70%" /></mj-section>',
    );

    expect(quarters.blocks[0]).toMatchObject({
      columns: "3",
      columnWidths: [25, 25, 50],
    });
    expect(uneven.blocks[0]).toMatchObject({
      columns: "3",
      columnWidths: [50, 33.33, 16.67],
    });
    expect(split.blocks[0]).toMatchObject({
      columns: "2",
      columnWidths: [30, 70],
    });
    for (const result of [quarters, uneven, split]) {
      const entry = result.entries.find(
        (item) => item.sourceTag === "mj-section",
      );
      expect(entry?.status).toBe("converted");
      expect(entry?.note).toBeUndefined();
    }
  });

  it("resolves a 200px column beside an absent one from MJML's default share", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="200px" /><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    // 200px is 33.33% of the 600px container. The absent column is 50, not
    // the leftover 66.67, so the row is scaled and approximated.
    expect(section.columns).toBe("2");
    expect(section.columnWidths).toEqual([40, 60]);
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      'Column widths 200px, auto have no exact Templatical layout; resolved to "2".',
    );
  });

  it("imports a 100px column beside an absent column as 1-3, where its scaled 16.67/50 shares land", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column width="100px" /><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    expect(section.columns).toBe("1-3");
    expect(section.columnWidths).toBeUndefined();
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      'Column widths 100px, auto have no exact Templatical layout; resolved to "1-3".',
    );
  });

  it("approximates 30% beside an absent column and 30/40, and keeps 30/70 exact", () => {
    const absent = build(
      '<mj-section><mj-column width="30%" /><mj-column><mj-text>B</mj-text></mj-column></mj-section>',
    );
    const short = build(
      '<mj-section><mj-column width="30%" /><mj-column width="40%" /></mj-section>',
    );
    const full = build(
      '<mj-section><mj-column width="30%" /><mj-column width="70%" /></mj-section>',
    );

    expect(absent.blocks[0]).toMatchObject({
      columns: "2",
      columnWidths: [37.5, 62.5],
    });
    expect(absent.entries[0]).toMatchObject({
      sourceTag: "mj-section",
      status: "approximated",
      note: 'Column widths 30%, auto have no exact Templatical layout; resolved to "2".',
    });
    expect(short.blocks[0]).toMatchObject({
      columns: "2",
      columnWidths: [42.86, 57.14],
    });
    expect(short.entries[0]).toMatchObject({
      status: "approximated",
      note: 'Column widths 30%, 40% have no exact Templatical layout; resolved to "2".',
    });
    expect(full.blocks[0]).toMatchObject({
      columns: "2",
      columnWidths: [30, 70],
    });
    expect(full.entries[0]).toMatchObject({ status: "converted" });
    expect(full.entries[0]?.note).toBeUndefined();
  });

  it("converts a px column against the section inner box, not the container", () => {
    const padded = build(
      '<mj-section padding="0 50px"><mj-column width="100px" /><mj-column width="80%" /></mj-section>',
    );
    const bordered = build(
      '<mj-section border="10px solid #112233"><mj-column width="116px" /><mj-column width="80%" /></mj-section>',
    );
    const paddedSection = padded.blocks[0] as SectionBlock;
    const borderedSection = bordered.blocks[0] as SectionBlock;

    // 600 − 50 − 50 = 500. 100px beside 80% of 500 (400px) is 20 / 80.
    expect(paddedSection.columns).toBe("2");
    expect(paddedSection.columnWidths).toEqual([20, 80]);
    expect(padded.entries[0]?.status).toBe("converted");
    expect(padded.entries[0]?.note).toBeUndefined();

    // A drawn 10px border on each side leaves 580. 116px is 20% of that.
    expect(borderedSection.columns).toBe("2");
    expect(borderedSection.columnWidths).toEqual([20, 80]);
    expect(bordered.entries[0]?.status).toBe("converted");
    expect(bordered.entries[0]?.note).toBeUndefined();
  });

  it("keeps four equal columns in four slots", () => {
    const { blocks, entries } = build(`
      <mj-section>
        <mj-column><mj-spacer height="1px" /></mj-column>
        <mj-column><mj-spacer height="2px" /></mj-column>
        <mj-column><mj-spacer height="3px" /></mj-column>
        <mj-column><mj-spacer height="4px" /></mj-column>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    expect(section.columns).toBe("4");
    expect(section.children).toHaveLength(4);
    expect(section.children.map((column) => column[0])).toMatchObject([
      { type: "spacer", height: 1 },
      { type: "spacer", height: 2 },
      { type: "spacer", height: 3 },
      { type: "spacer", height: 4 },
    ]);
    expect(entry.status).toBe("converted");
  });

  it("folds a fifth column into the fourth slot and names the limit", () => {
    const { blocks, entries } = build(`
      <mj-section>
        <mj-column width="20%"><mj-spacer height="1px" /></mj-column>
        <mj-column width="20%"><mj-spacer height="2px" /></mj-column>
        <mj-column width="20%"><mj-spacer height="3px" /></mj-column>
        <mj-column width="20%"><mj-spacer height="4px" /></mj-column>
        <mj-column width="20%"><mj-spacer height="5px" /></mj-column>
      </mj-section>`);
    const section = blocks[0] as SectionBlock;
    const entry = entries.find((e) => e.sourceTag === "mj-section")!;

    expect(section.columns).toBe("4");
    expect(section.children).toHaveLength(4);
    expect(section.children[3]).toHaveLength(2);
    expect(entry.note).toBe(
      'Column widths 20%, 20%, 20%, 20%, 20% have no exact Templatical layout; resolved to "4". Templatical supports up to four columns.',
    );
  });

  it("refuses a nested section, falling it back to html", () => {
    const { blocks, entries } = build(
      "<mj-section><mj-column><mj-section><mj-column /></mj-section></mj-column></mj-section>",
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0][0].type).toBe("html");
    const entry = entries.find((e) => e.status === "html-fallback")!;
    expect(entry.note).toBe(
      "MJML forbids <mj-section> inside <mj-column>; the nested section's markup is preserved as an html block.",
    );
  });

  it("refuses a nested wrapper, falling it back to html and naming the wrapper tag", () => {
    const { blocks, entries } = build(
      "<mj-section><mj-column><mj-wrapper><mj-section><mj-column /></mj-section></mj-wrapper></mj-column></mj-section>",
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0][0].type).toBe("html");
    const entry = entries.find((e) => e.status === "html-fallback")!;
    expect(entry).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "MJML forbids <mj-wrapper> inside <mj-column>; the nested wrapper's markup is preserved as an html block.",
    });
  });

  it("passes the column width down as the container width for images", () => {
    const { blocks } = build(
      '<mj-section><mj-column width="50%"><mj-image src="a.png" width="300px" /></mj-column><mj-column width="50%" /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0][0]).toMatchObject({
      type: "image",
      width: "full",
    });
  });

  it("passes the column width down as the container width for dividers", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column><mj-divider width="300px" /><mj-divider width="250px" /></mj-column><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(
      section.children[0].map((b) => (b.type === "divider" ? b.width : null)),
    ).toEqual(["full", 250]);
    expect(
      entries.filter((e) => e.sourceTag === "mj-divider").map((e) => e.status),
    ).toEqual(["converted", "converted"]);
  });

  it("measures a divider against its column less the column's side padding", () => {
    const { blocks } = build(
      '<mj-section><mj-column padding="0 30px"><mj-divider width="240px" /><mj-divider width="239px" /></mj-column><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(
      section.children[0].map((b) => (b.type === "divider" ? b.width : null)),
    ).toEqual(["full", 239]);
  });

  it("keeps document order across sections sharing one report array", () => {
    // `entries` is the document-wide report the whole walk shares, not a
    // per-section list — a document walker (Task 10) calls `buildSection`
    // once per top-level <mj-section>, passing the same array through every
    // call. Each section's own entry must land ahead of its own children AND
    // ahead of the next section's entry — document order, children nested
    // under their own parent — not retroactively spliced to the very front
    // of everything already collected.
    const markup = `
      <mj-section><mj-column><mj-spacer height="1px" /></mj-column></mj-section>
      <mj-section><mj-column><mj-spacer height="2px" /></mj-column></mj-section>
    `;
    const $: CheerioAPI = load(`<mjml><mj-body>${markup}</mj-body></mjml>`, {
      xml: { xmlMode: false, recognizeSelfClosing: true },
    });
    const ctx: ConvertContext = {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      contentWidth: 600,
      columnPadding: 0,
      direction: "ltr",
      warnings: [],
    };
    const entries: ImportReportEntry[] = [];

    for (const el of findByTag($, "mj-section").toArray()) {
      buildSection($(el) as unknown as Cheerio<Element>, ctx, entries);
    }

    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-section",
      "mj-spacer",
      "mj-section",
      "mj-spacer",
    ]);
  });
});

describe("convertColumnChildren display conditions", () => {
  it("recovers a display condition bracketing a single column child", () => {
    const { blocks } = build(
      "<mj-section><mj-column><mj-raw>{% if pro %}</mj-raw><mj-text><p>Only for pro</p></mj-text><mj-raw>{% endif %}</mj-raw></mj-column></mj-section>",
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0]).toHaveLength(1);
    expect(section.children[0][0].displayCondition).toEqual({
      label: "{% if pro %}",
      before: "{% if pro %}",
      after: "{% endif %}",
    });
  });

  it("emits no entry for the bracketing mj-raw pair inside a column", () => {
    const { entries } = build(
      "<mj-section><mj-column><mj-raw>{% if pro %}</mj-raw><mj-text><p>Only for pro</p></mj-text><mj-raw>{% endif %}</mj-raw></mj-column></mj-section>",
    );

    expect(entries.filter((e) => e.sourceTag === "mj-raw")).toEqual([]);
  });

  it("still converts an unpaired logic mj-raw inside a column to an html block", () => {
    const { blocks, entries } = build(
      '<mj-section><mj-column><mj-raw>{% if pro %}</mj-raw><mj-spacer height="4px" /></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;

    expect(section.children[0].map((b) => b.type)).toEqual(["html", "spacer"]);
    expect(section.children[0][0]).toMatchObject({
      type: "html",
      content: "{% if pro %}",
    });
    const rawEntry = entries.find((e) => e.sourceTag === "mj-raw")!;
    expect(rawEntry).toEqual({
      sourceTag: "mj-raw",
      templaticalBlockType: "html",
      status: "converted",
    });
  });
});

describe("full-width bands", () => {
  it("moves a full-width section background onto the wrapper", () => {
    const { blocks } = build(
      '<mj-section full-width="full-width" background-color="#111111"><mj-column><mj-text>Hi</mj-text></mj-column></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.backgroundImage).toBeUndefined();
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      fullWidth: true,
    });
  });

  it("moves a full-width section image onto the wrapper", () => {
    const { blocks } = build(
      '<mj-section full-width="full-width" background-url="https://cdn.test/band.jpg"><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    expect(section.backgroundImage).toBeUndefined();
    expect(section.wrapper?.backgroundImage?.url).toBe(
      "https://cdn.test/band.jpg",
    );
    expect(section.wrapper?.fullWidth).toBe(true);
  });

  it("leaves a full-width section with no background unwrapped", () => {
    const { blocks } = build(
      '<mj-section full-width="full-width"><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    expect(section.wrapper).toBeUndefined();
    expect(section.styles.backgroundColor).toBeUndefined();
  });

  it("keeps a section background when full-width is absent", () => {
    const { blocks } = build(
      '<mj-section background-color="#eeeeee"><mj-column /></mj-section>',
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#eeeeee");
    expect(section.wrapper).toBeUndefined();
  });

  it("sets fullWidth on an mj-wrapper that is full width", () => {
    const { blocks } = build(
      '<mj-wrapper full-width="full-width" background-color="#111111" padding="8px"><mj-section background-color="#ffffff"><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#ffffff");
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      fullWidth: true,
    });
  });

  it("keeps the section background when a painted wrapper already owns the band", () => {
    const { blocks } = build(
      '<mj-wrapper background-color="#222222"><mj-section full-width="full-width" background-color="#111111"><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#111111");
    expect(section.wrapper?.backgroundColor).toBe("#222222");
    expect(section.wrapper?.fullWidth).toBeUndefined();
  });

  it("keeps the section background inside a wrapper that is not full width", () => {
    const { blocks } = build(
      '<mj-wrapper padding="12px"><mj-section full-width="full-width" background-color="#111111"><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBe("#111111");
    expect(section.wrapper?.fullWidth).toBeUndefined();
    expect(section.wrapper?.padding).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    });
  });

  it("lifts a full-width section onto a full-width wrapper that paints nothing", () => {
    const { blocks } = build(
      '<mj-wrapper full-width="full-width" padding="4px"><mj-section full-width="full-width" background-color="#111111"><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;
    expect(section.styles.backgroundColor).toBeUndefined();
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
      fullWidth: true,
    });
  });
});

describe("buildWrapper", () => {
  it("folds a single-section wrapper into that section's wrapper field", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-color="#111111" padding="30px" border-radius="16px"><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    const section = blocks[0] as SectionBlock;

    expect(blocks).toHaveLength(1);
    expect(section.type).toBe("section");
    expect(section.wrapper).toEqual({
      backgroundColor: "#111111",
      padding: { top: 30, right: 30, bottom: 30, left: 30 },
      borderRadius: 16,
    });
    expect(entries.some((e) => e.sourceTag === "mj-wrapper")).toBe(false);
  });

  it("applies the wrapper to every section and reports the approximation", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-color="#111111"><mj-section><mj-column /></mj-section><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );

    expect(blocks).toHaveLength(2);
    expect((blocks[0] as SectionBlock).wrapper?.backgroundColor).toBe(
      "#111111",
    );
    expect((blocks[1] as SectionBlock).wrapper?.backgroundColor).toBe(
      "#111111",
    );

    const entry = entries.find((e) => e.sourceTag === "mj-wrapper")!;
    expect(entry).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: "An <mj-wrapper> holding 2 sections was applied to each of them — Templatical has no multi-section band.",
    });

    // The wrapper's entry is pushed before the `flatMap` that calls
    // `buildSection` once per section, and each of those pushes its own
    // entry immediately — so the wrapper leads, followed by both sections in
    // document order.
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-wrapper",
      "mj-section",
      "mj-section",
    ]);
  });

  it("gives each section of a multi-section wrapper its own wrapper and image objects", () => {
    const { blocks } = build(
      '<mj-wrapper background-url="https://cdn.test/band.jpg"><mj-section><mj-column /></mj-section><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );

    const [first, second] = blocks.map(
      (block) => (block as SectionBlock).wrapper!,
    );
    expect(first.backgroundImage).toEqual({
      url: "https://cdn.test/band.jpg",
      size: "auto",
      position: { x: "center", y: "top" },
      repeat: true,
    });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.backgroundImage).not.toBe(first.backgroundImage);
    expect(second.backgroundImage!.position).not.toBe(
      first.backgroundImage!.position,
    );
  });

  it("reads a per-corner border radius", () => {
    const { blocks, entries } = build(
      '<mj-wrapper border-radius="0 16px"><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    expect((blocks[0] as SectionBlock).wrapper?.borderRadius).toEqual({
      topLeft: 0,
      topRight: 16,
      bottomRight: 0,
      bottomLeft: 16,
    });
    expect(entries.some((e) => e.sourceTag === "mj-wrapper")).toBe(false);
  });

  it("reports a border radius it cannot read in an entry of its own", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-color="#111111" border-radius="2em"><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    expect((blocks[0] as SectionBlock).wrapper).toEqual({
      backgroundColor: "#111111",
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(entries.map((e) => e.sourceTag)).toEqual([
      "mj-wrapper",
      "mj-section",
    ]);
    expect(entries[0]).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Wrapper border-radius "2em" could not be read; imported as square corners.',
    });
  });

  it("reports a border, which a wrapper has no field for, as dropped", () => {
    const { blocks, entries } = build(
      '<mj-wrapper border="1px solid #000000" border-top="2px dashed #ff0000"><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    expect("border" in (blocks[0] as SectionBlock).wrapper!).toBe(false);
    expect(entries[0]).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note:
        'Wrapper border "1px solid #000000" has no Templatical equivalent; dropped. ' +
        'Wrapper border-top "2px dashed #ff0000" has no Templatical equivalent; dropped.',
    });
  });

  it("joins its own notes to the multi-section note", () => {
    const { entries } = build(
      '<mj-wrapper border-radius="50%"><mj-section><mj-column /></mj-section><mj-section><mj-column /></mj-section></mj-wrapper>',
      "wrapper",
    );
    expect(entries.filter((e) => e.sourceTag === "mj-wrapper")).toEqual([
      {
        sourceTag: "mj-wrapper",
        templaticalBlockType: "section",
        status: "approximated",
        note:
          "An <mj-wrapper> holding 2 sections was applied to each of them — Templatical has no multi-section band. " +
          'Wrapper border-radius "50%" could not be read; imported as square corners.',
      },
    ]);
  });
});

describe("buildSection background image", () => {
  it("maps background-url and its longhands onto backgroundImage, converted", () => {
    const { blocks, entries } = build(
      '<mj-section background-url="https://cdn.test/hero.jpg" background-size="cover" background-position="center top" background-repeat="no-repeat">' +
        "<mj-column><mj-text>Hi</mj-text></mj-column></mj-section>",
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

  it("reports a size with no keyword as approximated", () => {
    const { blocks, entries } = build(
      '<mj-section background-url="https://cdn.test/hero.jpg" background-size="100% auto">' +
        "<mj-column><mj-text>Hi</mj-text></mj-column></mj-section>",
    );
    expect((blocks[0] as SectionBlock).backgroundImage?.size).toBe("cover");
    expect(entries[0]).toEqual({
      sourceTag: "mj-section",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Section background-size "100% auto" has no exact Templatical equivalent; imported as "cover".',
    });
  });

  it("joins a background note after the border note", () => {
    const { entries } = build(
      '<mj-section border-radius="1em" background-url="u" background-repeat="repeat-x">' +
        "<mj-column><mj-text>Hi</mj-text></mj-column></mj-section>",
    );
    expect(entries[0].note).toBe(
      'Section border-radius "1em" could not be read; imported as square corners. ' +
        'Section background-repeat "repeat-x" has no exact Templatical equivalent; imported as "repeat".',
    );
  });

  it("omits backgroundImage when there is no background-url", () => {
    const { blocks } = build(
      '<mj-section background-size="cover"><mj-column><mj-text>Hi</mj-text></mj-column></mj-section>',
    );
    expect("backgroundImage" in blocks[0]).toBe(false);
  });
});

describe("buildWrapper background image", () => {
  it("maps the wrapper's background onto section.wrapper.backgroundImage", () => {
    const { blocks, entries } = build(
      '<mj-wrapper background-url="https://cdn.test/band.png" background-position="left bottom">' +
        "<mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-wrapper>",
      "wrapper",
    );
    expect((blocks[0] as SectionBlock).wrapper?.backgroundImage).toEqual({
      url: "https://cdn.test/band.png",
      size: "auto",
      position: { x: "left", y: "bottom" },
      repeat: true,
    });
    expect(entries.map((entry) => entry.sourceTag)).toEqual([
      "mj-section",
      "mj-text",
    ]);
  });

  it("reports a lossy wrapper value in the wrapper's own entry", () => {
    const { entries } = build(
      '<mj-wrapper background-url="u" background-repeat="repeat-y">' +
        "<mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-wrapper>",
      "wrapper",
    );
    expect(entries[0]).toEqual({
      sourceTag: "mj-wrapper",
      templaticalBlockType: "section",
      status: "approximated",
      note: 'Wrapper background-repeat "repeat-y" has no exact Templatical equivalent; imported as "repeat".',
    });
  });
});
