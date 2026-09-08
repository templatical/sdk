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

  it("recovers one block per source leaf, all still typed as paragraphs", async () => {
    const original = buildGroundTruth();
    const { content } = await roundTrip(original);
    const leaves = leafBlocks(content.blocks);
    const sourceLeaves = leafBlocks(original.blocks);
    const paragraphs = leaves.filter(isParagraph);

    // Desired, and the half the cell-level container descent owns: one block
    // per source leaf, not one per source *column*. mjml@5 puts every column
    // of a section into one <td> as a sibling `div.mj-column-per-*`, so a
    // container inside a cell has to be descended to reach the column's own
    // table. Handing it to `convertElement` instead maps `div` through
    // block-mapper's TEXT_TAGS and emits a single paragraph carrying that
    // whole table subtree as raw markup, which is what the second assertion
    // below rules out.
    expect(sourceLeaves).toHaveLength(13);
    expect(columnSlotCount(original.blocks)).toBe(10);
    expect(leaves).toHaveLength(sourceLeaves.length);
    expect(
      paragraphs.filter((block) => block.content.includes("<table")),
    ).toEqual([]);

    // Recorded defect, and a different one from the container descent — it is
    // a mapping question, not a traversal one, so it is deferred with the rest
    // of the block-mapper work in spec §7. The source declares 10 titles and 3
    // paragraphs; every leaf arrives as a paragraph, the titles carrying their
    // `<h3>` inside the paragraph's own content.
    //
    // mjml@5 wraps each `mj-text` body in a plain <div> that holds no table,
    // so it is correctly not a container to descend into; `convertElement`
    // maps it through TEXT_TAGS and `ensureParagraphWrapped` leaves the
    // heading markup untouched inside. Typing that block as a title means
    // unwrapping a container whose whole content is one block-level element.
    expect([...new Set(leaves.map((block) => block.type))]).toEqual([
      "paragraph",
    ]);
    expect(paragraphs).toHaveLength(sourceLeaves.length);
    expect(
      paragraphs.filter((block) => block.content.includes("<h3")),
    ).toHaveLength(10);
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
    // column.
    //
    // No traversal fix reaches this: mjml@5 gives a section's row exactly one
    // <td> holding a `div.mj-column-per-50` per column, so the row has one
    // cell and there is no count to resolve a layout from. Descending those
    // containers reaches each column's table, which is where the blocks come
    // from — but it says nothing about how many columns there were.
    // Recovering that means reading the width out of the class name, which is
    // the deferred tier.
    expect(columnLayouts(content.blocks)).toEqual(["1", "1", "1", "1", "1"]);
    expect(sections.map((section) => section.children.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);

    // Desired: the columns merge, but nothing inside them does. Each
    // section's single slot holds every leaf of the source section it came
    // from, in source order, so the collapse above is a layout loss and not a
    // content loss. Compared against the source's leaf count per section —
    // its column count is what a paragraph-per-column import matched.
    expect(sections.map((section) => section.children[0].length)).toEqual(
      original.blocks
        .filter(isSection)
        .map((section) => section.children.flat().length),
    );
  });

  it("accounts for every section it created, and reports no downgrade", async () => {
    const original = buildGroundTruth();
    const { content, report } = await roundTrip(original);
    const sectionEntries = report.entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );

    // Desired. The report accounts for the sections as well as the leaves:
    // one entry per imported section on top of one per source leaf, so a
    // caller can reconcile `report.entries` against `content.blocks` instead
    // of finding sections that appear nowhere in the report.
    //
    // The leaf term is the source's leaf count, not its column count: a
    // container descended inside a cell contributes no entry of its own —
    // nothing is created and nothing lost — so the entries are the blocks the
    // columns' own tables produced.
    const sourceLeafCount = leafBlocks(original.blocks).length;
    expect(report.summary).toEqual({
      total: sourceLeafCount + content.blocks.length,
      converted: sourceLeafCount + content.blocks.length,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
    expect(report.summary.total).toBe(18);
    expect(sectionEntries).toHaveLength(content.blocks.length);

    // `div` here is mjml@5's `mj-text` wrapper, one per source leaf — the
    // block-mapper defect case 3 records, not the per-column container the
    // descent now walks through. The count is asserted alongside the tag set
    // so the two cannot drift apart.
    expect([
      ...new Set(report.entries.map((entry) => entry.sourceTag)),
    ]).toEqual(["div", "tr"]);
    expect(
      report.entries.filter((entry) => entry.sourceTag === "div"),
    ).toHaveLength(sourceLeafCount);

    // Recorded defect, deferred to spec §7, and the shape of it matters: the
    // entries are honest, not merely optimistic. Each section came from a row
    // holding exactly one `<td>`, so `converted` with no note is the truthful
    // report of that row — mjml@5 expresses the columns as sibling divs
    // inside that single cell, so the row never carried a count to lose.
    //
    // So per-row reporting cannot surface this collapse, and a detection fix
    // is what has to move this case. When one lands, these two assertions
    // invert: the layouts above stop being all `"1"`, and there is nothing
    // left for a note to describe.
    expect(report.warnings).toEqual([]);
    expect(report.entries.filter((entry) => "note" in entry)).toEqual([]);
  });
});
