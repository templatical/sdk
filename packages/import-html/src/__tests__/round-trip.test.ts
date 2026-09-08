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
  TitleBlock,
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
 * Every case below is a desired property, so any of them failing is a
 * regression: the oracle recovers all five column layouts, one block per
 * source leaf, each block's declared type, and the per-slot grouping that
 * backs the layouts. Never relax one to keep the suite green.
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

function isTitle(block: Block): block is TitleBlock {
  return block.type === "title";
}

/**
 * Whether a block still carries a raw `<h3>` in its own content — the shape a
 * heading has when it was mapped as part of its wrapper instead of typed.
 */
function hasHeadingMarkup(block: Block): boolean {
  return "content" in block && String(block.content).includes("<h3");
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
    const sourceTitles = sourceLeaves.filter(isTitle).length;
    const sourceBodies = sourceLeaves.filter(isParagraph).length;

    expect([sourceTitles, sourceBodies]).toEqual([10, 3]);

    const imported = JSON.stringify(content);

    // Desired. Text is not lost — every heading and body string the source
    // declared reaches the imported template exactly once.
    expect(occurrences(imported, HEADING_TEXT)).toBe(sourceTitles);
    expect(occurrences(imported, BODY_TEXT)).toBe(sourceBodies);

    // Desired, and the same property one layer down: what `level: 3` rendered
    // as an `<h3>` comes back as a level rather than as markup. Asserted on
    // the level and on the markup's absence together, because either alone is
    // satisfiable by a heading that was typed but flattened to the default, or
    // by one left buried in a paragraph.
    const titles = leafBlocks(content.blocks).filter(isTitle);
    expect(titles).toHaveLength(sourceTitles);
    expect(new Set(titles.map((block) => block.level))).toEqual(new Set([3]));
    expect(occurrences(imported, "<h3")).toBe(0);
  });

  it("recovers one block per source leaf, each typed as the source declared", async () => {
    const original = buildGroundTruth();
    const { content } = await roundTrip(original);
    const leaves = leafBlocks(content.blocks);
    const sourceLeaves = leafBlocks(original.blocks);
    const paragraphs = leaves.filter(isParagraph);
    const titles = leaves.filter(isTitle);
    const sourceTitles = sourceLeaves.filter(isTitle).length;
    const sourceBodies = sourceLeaves.filter(isParagraph).length;

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

    // Desired, and the half the block mapper's container unwrap owns: each
    // leaf arrives as the type the source declared, 10 titles and 3
    // paragraphs, counted off the source rather than hardcoded.
    //
    // mjml@5 wraps each `mj-text` body in a plain <div> that holds no table,
    // so it is correctly not a container to *descend* — mapping it through
    // TEXT_TAGS instead left every heading buried in a paragraph's content.
    // A container whose whole meaningful content is one block-level element is
    // unwrapped, so the <h3> is what gets mapped.
    expect([sourceTitles, sourceBodies]).toEqual([10, 3]);
    expect(titles).toHaveLength(sourceTitles);
    expect(paragraphs).toHaveLength(sourceBodies);

    // The level is carried structurally, not as surviving markup: `level: 3`
    // is off the title factory's default (2), and no block is left holding
    // `<h3>` in its content.
    expect(titles.map((block) => block.level)).toEqual(
      Array.from({ length: sourceTitles }, () => 3),
    );
    expect(titles.map((block) => block.content)).toEqual(
      Array.from({ length: sourceTitles }, () => `<p>${HEADING_TEXT}</p>`),
    );
    expect(leaves.filter(hasHeadingMarkup)).toEqual([]);
  });

  it("recovers every section and every column layout", async () => {
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

    // Desired, and the half the column-ratio tier owns. mjml@5 gives a
    // section's row exactly one <td> holding a `div.mj-column-per-*` per
    // column, so the row has no cell count to read: the count comes from
    // counting those sibling containers, and the ratio from the share in
    // their class names. That class is the only signal available here —
    // every compiled column div also carries `style="width:100%"`, so a
    // reader preferring the inline style reports an equal split for all five.
    expect(columnLayouts(content.blocks)).toEqual(
      columnLayouts(original.blocks),
    );
    expect(sections.map((section) => section.children.length)).toEqual([
      1, 2, 3, 2, 2,
    ]);

    // Desired, and what keeps the layouts above from being a coincidence:
    // every leaf sits in the slot its source section put it in, so the
    // recovered column count is backed by the grouping and not just by a
    // number. Compared against the source's own per-slot occupancy.
    expect(
      sections.map((section) =>
        section.children.map((column) => column.length),
      ),
    ).toEqual(
      original.blocks
        .filter(isSection)
        .map((section) => section.children.map((column) => column.length)),
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

    // Which element each block came from, and the per-column container the
    // descent walks through appears in none of them: it creates nothing and
    // loses nothing. `h3` is a heading unwrapped out of mjml@5's `mj-text`
    // wrapper; `div` is that same wrapper still mapping the body copy it
    // holds, which is the `p` exclusion in the block mapper's unwrap set;
    // `tr` is a layout row. Counts are asserted alongside the tag set so the
    // two cannot drift apart.
    const sourceTitleCount = leafBlocks(original.blocks).filter(isTitle).length;
    const sourceBodyCount = leafBlocks(original.blocks).filter(
      isParagraph,
    ).length;
    expect([
      ...new Set(report.entries.map((entry) => entry.sourceTag)),
    ]).toEqual(["h3", "div", "tr"]);
    expect(
      report.entries.filter((entry) => entry.sourceTag === "h3"),
    ).toHaveLength(sourceTitleCount);
    expect(
      report.entries.filter((entry) => entry.sourceTag === "div"),
    ).toHaveLength(sourceBodyCount);
    expect(sourceTitleCount + sourceBodyCount).toBe(sourceLeafCount);

    // Desired, and now for the reason the wording claims: every layout was
    // recovered, so no row lost columns and none has a ratio the model could
    // not express. `mj-column-per-66-67` / `mj-column-per-33-33` snaps onto
    // `2-1` exactly, which is what leaves nothing for a note to describe.
    expect(report.warnings).toEqual([]);
    expect(report.entries.filter((entry) => "note" in entry)).toEqual([]);
  });
});
