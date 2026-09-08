import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { renderToMjml } from "@templatical/renderer";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
} from "@templatical/types";
import type {
  Block,
  ColumnLayout,
  ParagraphBlock,
  SectionBlock,
  TemplateContent,
} from "@templatical/types";
import { convertHtmlTemplate } from "../converter";

/**
 * The labelled ground truth this package otherwise has none of.
 *
 * Every other fixture here is a hand-written structural shape, so "did the
 * import get it right?" has no answer beyond the fixture author's intent. This
 * file builds a `TemplateContent` whose column layouts and block types are
 * known, renders it with this repo's own renderer, compiles that to real
 * table-soup HTML with mjml@5, and imports the result back. Every difference
 * from the source is a labelled failure with a known correct answer.
 *
 * Each case below is labelled desired or recorded defect, and each defect
 * names the spec section that owns its fix. A change that repairs one must
 * change that assertion — never relax it to keep the suite green.
 */

const HEADING_TEXT = "Ground truth heading";
const BODY_TEXT = "Ground truth body copy.";

/**
 * Values are chosen off the factory defaults on purpose: `level: 3` is not
 * `TITLE_BLOCK_DEFAULTS.level` (2) and neither string is a factory
 * placeholder, so an assertion that finds them cannot be satisfied by a
 * default that merely survived.
 */
function section(columns: ColumnLayout, blocksPerSlot: number[]): SectionBlock {
  return createSectionBlock({
    columns,
    children: blocksPerSlot.map((count) =>
      Array.from({ length: count }, (_, index) =>
        index === 0
          ? createTitleBlock({ content: `<p>${HEADING_TEXT}</p>`, level: 3 })
          : createParagraphBlock({ content: `<p>${BODY_TEXT}</p>` }),
      ),
    ),
  });
}

/** Five sections covering every `ColumnLayout`; only `"1"` is the default. */
function buildGroundTruth(): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [
      section("1", [2]),
      section("2", [2, 2]),
      section("3", [1, 1, 1]),
      section("2-1", [1, 1]),
      section("1-2", [1, 1]),
    ],
  };
}

function isSection(block: Block): block is SectionBlock {
  return block.type === "section";
}

function isParagraph(block: Block): block is ParagraphBlock {
  return block.type === "paragraph";
}

/** Content-bearing blocks, with a section replaced by its column children. */
function leafBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((block) =>
    isSection(block) ? block.children.flat() : [block],
  );
}

function columnLayouts(blocks: Block[]): ColumnLayout[] {
  return blocks.filter(isSection).map((block) => block.columns);
}

/** Total column slots across every section — the source's column count. */
function columnSlotCount(blocks: Block[]): number {
  return blocks
    .filter(isSection)
    .reduce((total, section) => total + section.children.length, 0);
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function roundTrip(original: TemplateContent) {
  const mjml = await renderToMjml(original);
  const compiled = await mjml2html(mjml, { validationLevel: "soft" });
  const imported = convertHtmlTemplate(compiled.html);

  return { compiled, ...imported };
}

describe("round trip: renderToMjml -> mjml2html -> convertHtmlTemplate", () => {
  it("compiles the rendered MJML without errors", async () => {
    const original = buildGroundTruth();
    const { compiled } = await roundTrip(original);
    const sourceTitles = leafBlocks(original.blocks).filter(
      (block) => block.type === "title",
    ).length;

    // Desired. mjml@5 collects template errors in `errors` instead of
    // throwing, so a silent regression in the renderer's output would
    // otherwise reach the importer and invalidate every case below.
    expect(compiled.errors).toEqual([]);
    expect(sourceTitles).toBe(10);
    expect(occurrences(compiled.html, HEADING_TEXT)).toBe(sourceTitles);
  });

  it("carries every heading and body string into the imported template", async () => {
    const original = buildGroundTruth();
    const { content } = await roundTrip(original);
    const sourceLeaves = leafBlocks(original.blocks);
    const sourceTitles = sourceLeaves.filter(
      (block) => block.type === "title",
    ).length;
    const sourceBodies = sourceLeaves.filter(isParagraph).length;

    expect([sourceTitles, sourceBodies]).toEqual([10, 3]);

    const imported = JSON.stringify(content);

    // Desired. Text is not lost — every heading and body string the source
    // declared reaches the imported template exactly once, and so does the
    // `<h3>` markup that `level: 3` rendered. Where it lands is what the
    // defect cases below record.
    expect(occurrences(imported, HEADING_TEXT)).toBe(sourceTitles);
    expect(occurrences(imported, BODY_TEXT)).toBe(sourceBodies);
    expect(occurrences(imported, "<h3")).toBe(sourceTitles);
  });

  it("flattens every typed leaf into a paragraph holding raw table markup", async () => {
    const original = buildGroundTruth();
    const { content } = await roundTrip(original);
    const leaves = leafBlocks(content.blocks);
    const paragraphs = leaves.filter(isParagraph);

    // Recorded defect, deferred with the column work in spec §7. The source
    // declares titles and paragraphs; the import yields one paragraph per
    // source *column*, each holding that column's whole <table> subtree as
    // its `content`.
    //
    // The cause is a cell-level container: mjml@5 puts every column of a
    // section into one <td> as a sibling `div.mj-column-per-*`, and
    // `extractCellBlocks` hands a container inside a cell straight to
    // `convertElement`, where `div` is in block-mapper's TEXT_TAGS. So the
    // column's own table is never examined.
    expect(columnSlotCount(original.blocks)).toBe(10);
    expect(leaves).toHaveLength(columnSlotCount(original.blocks));
    expect([...new Set(leaves.map((block) => block.type))]).toEqual([
      "paragraph",
    ]);
    expect(paragraphs[0].content).toContain("<table");
    expect(paragraphs[0].content).toContain("<h3");
  });

  it("recovers every section but none of their column layouts", async () => {
    const original = buildGroundTruth();
    const { content } = await roundTrip(original);
    const sections = content.blocks.filter(isSection);

    expect(columnLayouts(original.blocks)).toEqual([
      "1",
      "2",
      "3",
      "2-1",
      "1-2",
    ]);

    // Desired, and the half `processBody`'s container descent owns: one
    // section per source section, in source order. mjml@5 buries each
    // section's table under a body wrapper div plus a per-section div, and a
    // descent that stops at the first level maps the per-section div to a
    // paragraph swallowing the whole table — collapsing all five into one.
    expect(content.blocks).toHaveLength(original.blocks.length);
    expect(content.blocks.map((block) => block.type)).toEqual([
      "section",
      "section",
      "section",
      "section",
      "section",
    ]);

    // Recorded defect, deferred to spec §7 (the generic column-detection
    // heuristic and the MJML-compiled column tier). The five layouts above
    // are the known correct answer; every imported section reports one
    // column, and its single slot holds one paragraph per source column.
    //
    // No traversal fix reaches this: mjml@5 gives a section's row exactly one
    // <td> holding a `div.mj-column-per-50` per column, so there is no cell
    // count to resolve a layout from — and the one-cell wrapper descent finds
    // no table in that cell either, only those divs. Recovering the count
    // means reading the width out of that class, which is the deferred tier.
    expect(columnLayouts(content.blocks)).toEqual(["1", "1", "1", "1", "1"]);
    expect(sections.map((section) => section.children.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(sections.map((section) => section.children[0].length)).toEqual(
      original.blocks
        .filter(isSection)
        .map((section) => section.children.length),
    );
  });

  it("accounts for every section it created, and reports no downgrade", async () => {
    const original = buildGroundTruth();
    const { content, report } = await roundTrip(original);
    const sectionEntries = report.entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );

    // Desired. The report accounts for the sections as well as the leaves:
    // one entry per imported section on top of one per column slot, so a
    // caller can reconcile `report.entries` against `content.blocks` instead
    // of finding sections that appear nowhere in the report.
    expect(report.summary).toEqual({
      total: columnSlotCount(original.blocks) + content.blocks.length,
      converted: columnSlotCount(original.blocks) + content.blocks.length,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
    expect(report.summary.total).toBe(15);
    expect(sectionEntries).toHaveLength(content.blocks.length);
    expect([
      ...new Set(report.entries.map((entry) => entry.sourceTag)),
    ]).toEqual(["div", "tr"]);

    // Recorded defect, deferred to spec §7, and the shape of it matters: the
    // entries are honest, not merely optimistic. Each section came from a row
    // holding exactly one `<td>`, so `converted` with no note is the truthful
    // report of that row — the columns were already gone by the time the row
    // was read, lost in the per-column container inside that single cell.
    //
    // So per-row reporting cannot surface this collapse, and a detection fix
    // is what has to move this case. When one lands, these two assertions
    // invert: the layouts above stop being all `"1"`, and there is nothing
    // left for a note to describe.
    expect(report.warnings).toEqual([]);
    expect(report.entries.filter((entry) => "note" in entry)).toEqual([]);
  });
});
