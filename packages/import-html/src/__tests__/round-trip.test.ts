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
    const { content } = await roundTrip(buildGroundTruth());
    const leaves = leafBlocks(content.blocks);
    const paragraphs = leaves.filter(isParagraph);

    // Recorded defect, deferred with the column work in spec §7. The source
    // declares titles and paragraphs; the import yields one paragraph per
    // rendered section, each holding that section's whole <table> subtree as
    // its `content`.
    //
    // The cause sits upstream of column detection: mjml@5 wraps each section
    // in a plain <div>, `processBody` recurses into the outer wrapper, and
    // `div` is in block-mapper's TEXT_TAGS — so `convertElement` maps the
    // wrapper to a paragraph before `processTable` examines a single row.
    expect(leaves.map((block) => block.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(paragraphs[0].content).toContain("<table");
    expect(paragraphs[0].content).toContain("<h3");
  });

  it("collapses five known column layouts into one single-column section", async () => {
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

    // Recorded defect, deferred to spec §7 (the generic column-detection
    // heuristic and the MJML-compiled column tier). The five layouts above
    // are the known correct answer; the import returns one section whose
    // single slot holds all five paragraphs.
    //
    // `columns: "1"` here is `wrapInSection`'s literal in converter.ts, not a
    // resolved layout — which is why the four non-default layouts in the
    // ground truth carry the weight of this comparison.
    expect(content.blocks).toHaveLength(1);
    expect(columnLayouts(content.blocks)).toEqual(["1"]);
    expect(sections[0].children).toHaveLength(1);
    expect(sections[0].children[0]).toHaveLength(5);
  });

  it("reports the collapse as a clean conversion", async () => {
    const { report } = await roundTrip(buildGroundTruth());

    // Recorded defect (spec §2.2): a caller reading this report concludes a
    // perfect import while five sections and every block type were lost.
    //
    // Every entry's `sourceTag` is `div`, which locates the loss: it happens
    // in `processBody`, never reaching `resolveColumnLayout`. Per-row
    // reporting (spec §3.2) therefore has no row to describe on this path.
    expect(report.summary).toEqual({
      total: 5,
      converted: 5,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
    expect(report.warnings).toEqual([]);
    expect(report.entries.map((entry) => entry.sourceTag)).toEqual([
      "div",
      "div",
      "div",
      "div",
      "div",
    ]);
    expect(report.entries.filter((entry) => "note" in entry)).toEqual([]);
  });
});
