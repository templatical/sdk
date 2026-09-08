import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { processTable } from "../section-builder";
import { convertHtmlTemplate } from "../converter";
import type { Block, SectionBlock } from "@templatical/types";
import type { Element } from "domhandler";
import type { Cheerio } from "cheerio";
import type { ImportReportEntry } from "../types";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf-8");
}

/**
 * Loads HTML, grabs the first `<table>`, and runs `processTable` against it,
 * collecting the entries/warnings the way the converter would.
 */
function runTable(
  html: string,
  flattenInline = false,
): {
  blocks: Block[];
  entries: ImportReportEntry[];
  warnings: string[];
} {
  const $ = load(html);
  const $table = $("table").first() as unknown as Cheerio<Element>;
  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks = processTable($table, $, entries, warnings, flattenInline);
  return { blocks, entries, warnings };
}

/** Content-bearing blocks, with a section replaced by its column children. */
function leaves(blocks: Block[]): Block[] {
  return blocks.flatMap((block) =>
    block.type === "section" ? block.children.flat() : [block],
  );
}

/**
 * Wraps `inner` in a single-cell layout table and returns the cell's blocks.
 *
 * The wrapping row emits a section, so `entries` ends with that section's own
 * `tr` entry after the cell's blocks. `blocks` is unwrapped to the leaves, so
 * only entry assertions see it.
 */
function runCell(
  inner: string,
  cellAttrs = "",
): {
  blocks: Block[];
  entries: ImportReportEntry[];
  warnings: string[];
} {
  const r = runTable(
    `<table role="presentation"><tr><td ${cellAttrs}>${inner}</td></tr></table>`,
  );
  return { ...r, blocks: leaves(r.blocks) };
}

describe("processTable — nested layout table flattens into parent column", () => {
  it("a 2-level nested table with an image flattens into the parent cell column", () => {
    const { content } = convertHtmlTemplate(fixture("nested-table.html"));

    // Single outer row → single section, single column. The inner tables do
    // NOT create their own sections — their blocks flatten into the parent
    // column alongside the heading.
    expect(content.blocks).toHaveLength(1);
    const section = content.blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);

    const column = section.children[0];
    expect(column.map((b) => b.type)).toEqual(["title", "image"]);

    const title = column[0];
    if (title.type !== "title") throw new Error("expected title block");
    expect(title.content).toContain("Section heading");

    // The image sits two nested-table levels deep but lands flat in the column.
    const image = column[1];
    if (image.type !== "image") throw new Error("expected image block");
    expect(image.src).toBe("https://x/nested.jpg");
    expect(image.alt).toBe("Nested");
    expect(image.width).toBe(120);

    // No nested section block was emitted anywhere.
    const nestedSection = section.children
      .flat()
      .find((b) => b.type === "section");
    expect(nestedSection).toBeUndefined();
  });

  it("processTable with flattenInline=true returns a flat block list (no section wrapper)", () => {
    const { blocks } = runTable(
      `<table role="presentation"><tr><td><h2>Inner heading</h2></td><td><p>Inner text</p></td></tr></table>`,
      true,
    );
    // Two cells, both flattened to a single flat list — NOT a section.
    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
    expect(blocks.find((b) => b.type === "section")).toBeUndefined();
  });

  it("processTable with flattenInline=false wraps the row in a section", () => {
    const { blocks } = runTable(
      `<table role="presentation"><tr><td><h2>Heading</h2></td></tr></table>`,
      false,
    );
    expect(blocks).toHaveLength(1);
    const section = blocks[0] as SectionBlock;
    expect(section.type).toBe("section");
    expect(section.columns).toBe("1");
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
  });
});

describe("processTable — styled loose anchor in a cell becomes a button", () => {
  it("a styled <a> loose alongside a nested table converts to a button block", () => {
    // The cell holds a styled CTA anchor AND a nested table containing a plain
    // anchor. Two anchors total means the cell is NOT classified as a single
    // button cell, so the per-child loop runs: the styled <a> hits the
    // anchor-button branch, and the nested table flattens.
    const html = `<table role="presentation"><tr><td>
        <a style="background:#ff0000;padding:10px 20px;border-radius:4px" href="https://cta.com">Styled CTA</a>
        <table role="presentation"><tr><td>
          <table role="presentation"><tr><td>
            <a href="https://inner.com">inner plain link</a>
          </td></tr></table>
        </td></tr></table>
      </td></tr></table>`;
    const { blocks, entries } = runTable(html, false);

    expect(blocks).toHaveLength(1);
    const section = blocks[0] as SectionBlock;
    expect(section.columns).toBe("1");
    const column = section.children[0];
    expect(column.map((b) => b.type)).toEqual(["button", "paragraph"]);

    const button = column[0];
    if (button.type !== "button") throw new Error("expected button block");
    expect(button.text).toBe("Styled CTA");
    expect(button.url).toBe("https://cta.com");
    expect(button.backgroundColor).toBe("#ff0000");
    expect(button.borderRadius).toBe(4);
    expect(button.buttonPadding).toEqual({
      top: 10,
      right: 20,
      bottom: 10,
      left: 20,
    });

    // The deeply-nested plain anchor folded into the run of its own cell, so
    // the paragraph carries the link rather than only its words.
    const para = column[1];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toContain(
      '<a href="https://inner.com">inner plain link</a>',
    );

    // Entry metadata: the styled anchor reports as a converted button.
    const buttonEntry = entries.find(
      (e) => e.sourceTag === "a" && e.templaticalBlockType === "button",
    );
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry!.status).toBe("converted");
  });
});

describe("processTable — data table preserved as HTML fallback", () => {
  it("a bare data table (text-only cells) returns a single html-fallback block", () => {
    const { blocks, entries } = runTable(
      `<table><tr><td>Name</td><td>Age</td></tr><tr><td>Ada</td><td>30</td></tr></table>`,
      false,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("html");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      sourceTag: "table",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "Data table preserved as HTML block.",
    });
  });

  it("a layout table with no rows returns no blocks", () => {
    // isLayoutTable is true (it finds the descendant <img> in the caption), but
    // there are no <tr> rows, so the early row-length guard returns [] without
    // emitting any section or fallback entry.
    const { blocks, entries } = runTable(
      `<table role="presentation"><caption><img src="https://x/cap.jpg" /></caption></table>`,
      false,
    );
    expect(blocks).toEqual([]);
    expect(entries).toEqual([]);
  });
});

describe("extractCellBlocks — inline formatting stays in the text around it", () => {
  it("keeps both words of Hello<br>World in one paragraph, with no html block", () => {
    const { blocks, entries } = runCell("Hello<br>World");

    expect(blocks.some((b) => b.type === "html")).toBe(false);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    const para = blocks[0];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toBe("<p>Hello<br>World</p>");
    expect(entries).toEqual([
      {
        sourceTag: "td",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      { sourceTag: "tr", templaticalBlockType: "section", status: "converted" },
    ]);
  });

  it("keeps <em> markup and the text on both sides of it", () => {
    const { blocks } = runCell("Plain <em>emph</em> tail");

    expect(blocks.some((b) => b.type === "html")).toBe(false);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    const para = blocks[0];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toBe("<p>Plain <em>emph</em> tail</p>");
  });

  it("keeps <strong> markup and the text on both sides of it", () => {
    const { blocks } = runCell("Plain <strong>bold</strong> tail");

    expect(blocks.some((b) => b.type === "html")).toBe(false);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    const para = blocks[0];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toBe("<p>Plain <strong>bold</strong> tail</p>");
  });

  it("gives the same paragraph whether or not the run is wrapped in a <p>", () => {
    // The wrapped form already worked because `p` is in block-mapper's
    // TEXT_TAGS, which captures the whole subtree. The bare form has to agree
    // with it, or a template's fidelity depends on whether its author wrapped
    // the line.
    const bare = runCell("Plain <strong>bold</strong> tail");
    const wrapped = runCell("<p>Plain <strong>bold</strong> tail</p>");

    const bareBlock = bare.blocks[0];
    const wrappedBlock = wrapped.blocks[0];
    if (bareBlock.type !== "paragraph" || wrappedBlock.type !== "paragraph")
      throw new Error("expected paragraph blocks");
    expect(bareBlock.content).toBe(wrappedBlock.content);
    expect(bareBlock.content).toBe("<p>Plain <strong>bold</strong> tail</p>");
  });

  it("keeps the prose that follows a heading and a line break", () => {
    // The shape that carries most of the loss in real templates: a heading,
    // a spacer <br>, then a bare paragraph of copy with no wrapper at all.
    const { blocks, entries } = runCell(
      "<h3>Kittens</h3><br>A kitten is a juvenile cat.",
    );

    expect(blocks.some((b) => b.type === "html")).toBe(false);
    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
    const para = blocks[1];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toBe("<p><br>A kitten is a juvenile cat.</p>");
    expect(entries.map((e) => [e.sourceTag, e.status])).toEqual([
      ["h3", "converted"],
      ["td", "converted"],
      ["tr", "converted"],
    ]);
  });

  it("flushes a run before the blocks of a table that interrupts it", () => {
    const { blocks } = runCell(
      "Lead copy" +
        '<table role="presentation"><tr><td>' +
        '<img src="https://x.test/n.jpg" alt="Nested" width="120">' +
        "</td></tr></table>" +
        "Trailing copy",
    );

    // Order matters: a run flushed late would print the lead copy after the
    // image it introduces.
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "image",
      "paragraph",
    ]);
    const lead = blocks[0];
    const trailing = blocks[2];
    if (lead.type !== "paragraph" || trailing.type !== "paragraph")
      throw new Error("expected paragraph blocks");
    expect(lead.content).toBe("<p>Lead copy</p>");
    expect(trailing.content).toBe("<p>Trailing copy</p>");
  });

  it("emits nothing for the whitespace between two elements", () => {
    const { blocks, entries } = runCell("\n  <h3>Only</h3>\n  ");

    expect(blocks.map((b) => b.type)).toEqual(["title"]);
    // Naming the tags rather than counting them: the heading and the row's
    // section are the only two entries, so a paragraph for the whitespace
    // would show up as a third rather than merely shifting a length.
    expect(entries.map((e) => e.sourceTag)).toEqual(["h3", "tr"]);
  });

  it("emits nothing for a run of nbsp and line breaks", () => {
    const { blocks, entries } = runCell("&nbsp;<br><br><h3>Only</h3>");

    expect(blocks.map((b) => b.type)).toEqual(["title"]);
    expect(entries.map((e) => e.sourceTag)).toEqual(["h3", "tr"]);
  });

  it("does not let a comment split a run", () => {
    // Merge-tag comments sit mid-sentence all over real templates. The cell
    // needs one element child so the walk runs at all — a cell with none
    // takes the text-only path below.
    const { blocks } = runCell("Before <!-- *|IF:X|* --> after <em>x</em>");

    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    const para = blocks[0];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toBe("<p>Before  after <em>x</em></p>");
  });

  it("still falls back to an html block for a genuinely unknown element", () => {
    // The negative control on the fold: an element with no mapping must stay
    // an html-fallback. Without this, widening the inline set would quietly
    // swallow unsupported markup into a paragraph and report success.
    const { blocks, entries } = runCell(
      "Before <marquee>scroll</marquee> after",
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "html",
      "paragraph",
    ]);
    const fallback = blocks[1];
    if (fallback.type !== "html") throw new Error("expected html block");
    expect(fallback.content).toContain("<marquee>scroll</marquee>");
    expect(entries[1]).toEqual({
      sourceTag: "marquee",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: 'Unknown element "marquee" preserved as HTML block.',
    });
  });

  it("folds a plain anchor into the sentence around it", () => {
    // A link in prose is prose. The anchor joins the run on both sides of it,
    // so one rich-text block carries the whole sentence and the author edits
    // it as a unit — with the anchor's own markup, href included, inside.
    const { blocks, entries } = runCell(
      'Click <a href="https://x.test/go">here</a> now',
    );

    expect(blocks).toHaveLength(1);
    const sentence = blocks[0];
    if (sentence.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(sentence.content).toBe(
      '<p>Click <a href="https://x.test/go">here</a> now</p>',
    );
    expect(entries).toEqual([
      {
        sourceTag: "td",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      { sourceTag: "tr", templaticalBlockType: "section", status: "converted" },
    ]);
    // Nothing was approximated, so nothing carries a note.
    expect(entries.filter((entry) => "note" in entry)).toEqual([]);
  });

  it("keeps the words around a self-styled anchor and still emits its button", () => {
    // The negative control on the fold. A styled anchor is a call to action
    // rather than prose, and `looksLikeButton` is consulted before the anchor
    // can join a run — so the text on either side becomes a run of its own
    // and the anchor becomes a button. `isButtonCell` declined the cell
    // first, because the link is not the cell's entire content.
    const { blocks, entries } = runCell(
      'Click <a style="background:#ff0000;padding:8px 16px" ' +
        'href="https://x.test/go">here</a> now',
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "button",
      "paragraph",
    ]);
    const before = blocks[0];
    if (before.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(before.content).toBe("<p>Click </p>");
    const after = blocks[2];
    if (after.type !== "paragraph") throw new Error("expected paragraph block");
    expect(after.content).toBe("<p> now</p>");
    const button = blocks[1];
    if (button.type !== "button") throw new Error("expected button block");
    expect(button.text).toBe("here");
    expect(button.url).toBe("https://x.test/go");
    expect(button.backgroundColor).toBe("#ff0000");
    expect(entries).toEqual([
      {
        sourceTag: "td",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      { sourceTag: "a", templaticalBlockType: "button", status: "converted" },
      {
        sourceTag: "td",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      { sourceTag: "tr", templaticalBlockType: "section", status: "converted" },
    ]);
  });

  it("reads a cell holding nothing but text as text", () => {
    // A cell with no element children is still content: its text node is a
    // run like any other. Handing the `<td>` itself to `convertElement`
    // matches no mapping and comes back as an html block, which is the
    // reading this pins against.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>Just text</td></tr>' +
        '<tr><td><img src="https://x.test/a.jpg" alt="Artwork"></td></tr></table>',
    );

    const cellBlocks = leaves(blocks);
    expect(cellBlocks.map((b) => b.type)).toEqual(["paragraph", "image"]);
    expect(cellBlocks.some((b) => b.type === "html")).toBe(false);
    const copy = cellBlocks[0];
    if (copy.type !== "paragraph") throw new Error("expected paragraph block");
    expect(copy.content).toBe("<p>Just text</p>");
    expect(entries[0]).toEqual({
      sourceTag: "td",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
    expect(entries.filter((entry) => "note" in entry)).toEqual([]);
  });
});

describe("extractCellBlocks — a button cell is one whose whole content is the link", () => {
  it("converts a padded cell holding nothing but the anchor to one button", () => {
    const { blocks, entries } = runCell(
      '<a href="https://events.test/claim">Claim your seat</a>',
      'style="background:#0b7285;padding:14px;border-radius:9px;font-size:19px"',
    );

    expect(blocks.map((b) => b.type)).toEqual(["button"]);
    const button = blocks[0];
    if (button.type !== "button") throw new Error("expected button block");
    expect(button.text).toBe("Claim your seat");
    expect(button.url).toBe("https://events.test/claim");
    expect(button.backgroundColor).toBe("#0b7285");
    expect(button.borderRadius).toBe(9);
    expect(button.fontSize).toBe(19);
    expect(entries).toEqual([
      { sourceTag: "td", templaticalBlockType: "button", status: "converted" },
      { sourceTag: "tr", templaticalBlockType: "section", status: "converted" },
    ]);
  });

  it("keeps the prose around an inline anchor in a padded cell", () => {
    // The defect this guards: `buildCellButton` labels the button with the
    // anchor's text and drops every other node in the cell, so reading a
    // sentence as a button deletes the sentence.
    const { blocks, entries } = runCell(
      'Read the <a href="https://legal.test/terms">terms</a> before you continue',
      'style="background:#0b7285;padding:14px"',
    );

    expect(blocks).toHaveLength(1);
    const sentence = blocks[0];
    if (sentence.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(sentence.content).toBe(
      '<p>Read the <a href="https://legal.test/terms">terms</a>' +
        " before you continue</p>",
    );
    expect(sentence.styles.padding).toEqual({
      top: 14,
      right: 14,
      bottom: 14,
      left: 14,
    });
    expect(entries.map((e) => e.templaticalBlockType)).toEqual([
      "paragraph",
      "section",
    ]);
  });

  it("keeps an outer cell's prose while the nested cell stays a button", () => {
    const { blocks, entries } = runCell(
      "Callout copy about the offer" +
        '<table role="presentation"><tr><td style="background:#0b7285;padding:10px">' +
        '<a href="https://shop.test/buy">Purchase Now</a>' +
        "</td></tr></table>",
      'style="padding:14px"',
    );

    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "button"]);
    const prose = blocks[0];
    if (prose.type !== "paragraph") throw new Error("expected paragraph block");
    expect(prose.content).toBe("<p>Callout copy about the offer</p>");
    const button = blocks[1];
    if (button.type !== "button") throw new Error("expected button block");
    expect(button.text).toBe("Purchase Now");
    expect(button.url).toBe("https://shop.test/buy");
    expect(button.backgroundColor).toBe("#0b7285");
    expect(entries).toEqual([
      {
        sourceTag: "td",
        templaticalBlockType: "paragraph",
        status: "converted",
      },
      { sourceTag: "td", templaticalBlockType: "button", status: "converted" },
      { sourceTag: "tr", templaticalBlockType: "section", status: "converted" },
    ]);
  });
});

describe("extractCellBlocks — a plain anchor folds, a styled one does not", () => {
  /**
   * One cell's blocks and entries, in a table an image row makes a layout
   * table.
   *
   * A table whose every cell holds only text is a *data* table and is
   * preserved whole as one html block, so a cell with no element children is
   * unreachable through `runCell` — the sibling row is what gets the walk to
   * run at all.
   */
  function runTextOnlyCell(
    inner: string,
    cellAttrs = "",
  ): { blocks: Block[]; entries: ImportReportEntry[] } {
    const { blocks, entries } = runTable(
      '<table role="presentation">' +
        `<tr><td ${cellAttrs}>${inner}</td></tr>` +
        '<tr><td><img src="https://x.test/layout.png" alt="Layout"></td></tr>' +
        "</table>",
    );
    const firstRow = blocks[0];
    if (firstRow.type !== "section") throw new Error("expected section block");
    // Entries are emitted in order, so the first cell's end where its row's
    // own entry begins.
    const rowEntry = entries.findIndex((entry) => entry.sourceTag === "tr");
    return {
      blocks: firstRow.children.flat(),
      entries: entries.slice(0, rowEntry),
    };
  }

  it("keeps a lone plain anchor's href, which the per-element path drops", () => {
    // `convertElement`'s anchor arm builds its paragraph from the anchor's
    // *inner* HTML, so the `<a>` — and with it the destination — never
    // reaches the block. Folding the anchor into the run keeps the markup.
    const { blocks, entries } = runCell(
      '<a href="https://x.test/read">Read the full story</a>',
    );

    expect(blocks).toHaveLength(1);
    const link = blocks[0];
    if (link.type !== "paragraph") throw new Error("expected paragraph block");
    expect(link.content).toBe(
      '<p><a href="https://x.test/read">Read the full story</a></p>',
    );
    expect(entries[0]).toEqual({
      sourceTag: "td",
      templaticalBlockType: "paragraph",
      status: "converted",
    });
  });

  it("folds every plain anchor of a sentence into that one sentence", () => {
    // Two anchors take the cell past `isButtonCell`'s single-anchor test by a
    // different route than a prose fragment does, and the run has to survive
    // both of them rather than restarting at the second.
    const { blocks } = runCell(
      'See the <a href="https://legal.test/terms">terms</a> and the ' +
        '<a href="https://legal.test/privacy">privacy notice</a> today',
    );

    expect(blocks).toHaveLength(1);
    const sentence = blocks[0];
    if (sentence.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(sentence.content).toBe(
      '<p>See the <a href="https://legal.test/terms">terms</a> and the ' +
        '<a href="https://legal.test/privacy">privacy notice</a> today</p>',
    );
  });

  it("leaves an anchor carrying no text as a block of its own", () => {
    // The hazard behind the fold's text requirement: `convertInlineRun` reads
    // a run with no text as empty and emits nothing, so an image-only link
    // folded into one would disappear. It keeps its own block instead.
    const { blocks } = runCell(
      '<a href="https://x.test/go">' +
        '<img src="https://x.test/promo.png" alt="Promo"></a>',
    );

    expect(blocks).toHaveLength(1);
    const link = blocks[0];
    if (link.type !== "paragraph") throw new Error("expected paragraph block");
    expect(link.content).toBe(
      '<p><img src="https://x.test/promo.png" alt="Promo"></p>',
    );
  });

  it("still emits a spacer for an empty cell that states a height", () => {
    // The spacer branch runs before the cell is walked, and an empty cell
    // reaches that walk rather than an early return — so this is where the
    // two would collide.
    const { blocks, entries } = runTextOnlyCell("&nbsp;", 'height="42"');

    expect(blocks).toHaveLength(1);
    const spacer = blocks[0];
    if (spacer.type !== "spacer") throw new Error("expected spacer block");
    expect(spacer.height).toBe(42);
    expect(entries).toEqual([
      { sourceTag: "td", templaticalBlockType: "spacer", status: "converted" },
    ]);
  });

  it("emits nothing for an empty cell that states no height", () => {
    // An empty cell is neither a spacer nor content, so it contributes no
    // block and no entry at all.
    const { blocks, entries } = runTextOnlyCell("&nbsp; ");

    expect(blocks).toEqual([]);
    expect(entries).toEqual([]);
  });

  it("styles a text-only cell from the cell's own typography", () => {
    // The reading an html block cannot express: the cell's colour, size and
    // alignment become the paragraph's, instead of riding along as raw markup
    // the editor cannot touch.
    const { blocks } = runTextOnlyCell(
      "Cell copy with no wrapper",
      'style="color:#2b8a3e;font-size:19px;text-align:right"',
    );

    expect(blocks).toHaveLength(1);
    const copy = blocks[0];
    if (copy.type !== "paragraph") throw new Error("expected paragraph block");
    expect(copy.content).toBe(
      '<p style="text-align: right">' +
        '<span style="font-size: 19px; color: #2b8a3e">' +
        "Cell copy with no wrapper" +
        "</span></p>",
    );
  });
});

describe("processTable — a one-cell wrapper row is not a layout row", () => {
  /** A two-column layout row, as the markup a wrapper hides. */
  const twoColumnTable =
    '<table role="presentation"><tr>' +
    "<td><h2>Left heading</h2></td>" +
    "<td><p>Right copy.</p></td>" +
    "</tr></table>";

  function onlySection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  it("descends one wrapper row to the two-column table it holds", () => {
    const { blocks, warnings } = runTable(
      `<table role="presentation"><tr><td>${twoColumnTable}</td></tr></table>`,
    );
    const section = onlySection(blocks);

    // "2" is off the section factory's default, and the slot count is what
    // says the columns are real rather than a relabelled single column.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["title"], ["paragraph"]],
    );

    const heading = section.children[0][0];
    const copy = section.children[1][0];
    if (heading.type !== "title" || copy.type !== "paragraph")
      throw new Error("expected a title and a paragraph");
    expect(heading.content).toBe("<p>Left heading</p>");
    expect(copy.content).toBe("<p>Right copy.</p>");
    expect(warnings).toEqual([]);
  });

  it("descends through two wrapper rows to the same two-column table", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        '<table role="presentation"><tr><td>' +
        twoColumnTable +
        "</td></tr></table>" +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["title"], ["paragraph"]],
    );
  });

  it("descends into every table a wrapper cell holds, in source order", () => {
    // The shape the corpus wraps a whole email in: two sibling tables and a
    // text-free <br>, which produces no block and so cannot be lost.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>' +
        twoColumnTable +
        '<table role="presentation"><tr><td><p>Footer copy.</p></td></tr></table>' +
        "<br>" +
        "</td></tr></table>",
    );

    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.type)).toEqual(["section", "section"]);
    const [first, second] = blocks as SectionBlock[];
    expect([first.columns, second.columns]).toEqual(["2", "1"]);
    expect([first.children.length, second.children.length]).toEqual([2, 1]);

    const footer = second.children[0][0];
    if (footer.type !== "paragraph") throw new Error("expected paragraph");
    expect(footer.content).toBe("<p>Footer copy.</p>");
    // The <br> carries no text, so no block and no entry stands for it. Each
    // table's own row reports the section it emits, right after that row's
    // cells — so the two sections are what mark the boundary between them.
    expect(entries.map((e) => e.templaticalBlockType)).toEqual([
      "title",
      "paragraph",
      "section",
      "paragraph",
      "section",
    ]);
  });

  it("descends a wrapper row sitting between two layout rows", () => {
    // Row-level, not table-level: the corpus buries the two-column row in the
    // middle row of a three-row table, so a table-level wrapper test would
    // never reach it.
    const { blocks } = runTable(
      '<table role="presentation">' +
        "<tr><td><h2>Masthead</h2></td></tr>" +
        `<tr><td>${twoColumnTable}</td></tr>` +
        "<tr><td><p>Footer copy.</p></td></tr>" +
        "</table>",
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "section",
      "section",
      "section",
    ]);
    const sections = blocks as SectionBlock[];
    expect(sections.map((s) => s.columns)).toEqual(["1", "2", "1"]);
    expect(sections.map((s) => s.children.length)).toEqual([1, 2, 1]);
    expect(sections.map((s) => s.children.flat().map((b) => b.type))).toEqual([
      ["title"],
      ["title", "paragraph"],
      ["paragraph"],
    ]);
  });

  it("flattens a wrapper row instead of nesting a section in a column", () => {
    // Templatical forbids a section inside a column, so a wrapper reached
    // from a parent cell must keep flattening.
    const { blocks } = runTable(
      `<table role="presentation"><tr><td>${twoColumnTable}</td></tr></table>`,
      true,
    );

    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
    expect(blocks.some((b) => b.type === "section")).toBe(false);
  });

  it("keeps a genuine single-column row as a one-column section", () => {
    // Shaped exactly like a wrapper apart from the cell's content: this is
    // the row the descent must not eat.
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        "<h2>Only heading</h2><p>Only copy.</p>" +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
  });

  it("keeps a heading that sits beside the table in a wrapper cell", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        "<h2>Beside the table</h2>" +
        twoColumnTable +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    // Not packaging: descending would drop the heading, so the row stays a
    // section and the inner table flattens into it as before.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "title",
      "paragraph",
    ]);
    const aside = section.children[0][0];
    if (aside.type !== "title") throw new Error("expected title block");
    expect(aside.content).toBe("<p>Beside the table</p>");
  });

  it("keeps a styled wrapper row as the section that carries its band", () => {
    const { blocks } = runTable(
      '<table role="presentation">' +
        '<tr style="background-color:#123456;padding:12px"><td>' +
        twoColumnTable +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    // The section is the only carrier for a row's background and padding, so
    // a styled row is kept even though its cell is packaging.
    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#123456");
    expect(section.styles.padding).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    });
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
  });

  it("keeps a band declared on the layout row it descends to", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        '<table role="presentation"><tr style="background-color:#654321">' +
        "<td><h2>Left heading</h2></td>" +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>" +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    // The gate above is about the wrapper row's own styling, not about
    // backgrounds: a band on the layout row survives the descent.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.styles.backgroundColor).toBe("#654321");
  });
});

describe("processTable — the section a row produces is in the report", () => {
  function theSection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  it("a faithful multi-cell row reports converted with no note", () => {
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr>' +
        "<td><h2>Left heading</h2></td>" +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>",
    );
    const section = theSection(blocks);

    // "2" is not the section factory's default, so the pairing of the layout
    // with two slots is what proves the row's own cell count was read.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);

    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].sourceTag).toBe("tr");
    expect(sectionEntries[0].status).toBe("converted");
    // A faithful conversion carries no note at all. `toEqual` cannot see an
    // `undefined`-valued key, so the absence needs `in`.
    expect("note" in sectionEntries[0]).toBe(false);

    // The cells' own blocks keep their entries; the section adds one.
    expect(entries.map((entry) => entry.sourceTag)).toEqual(["h2", "p", "tr"]);
  });

  it("a faithful single-cell row reports converted with no note", () => {
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td><h2>Only heading</h2></td></tr></table>',
    );
    const section = theSection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);

    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].status).toBe("converted");
    expect("note" in sectionEntries[0]).toBe(false);
  });

  it("a row of four cells reports approximated and names the collapse", () => {
    const { blocks, entries, warnings } = runTable(
      '<table role="presentation"><tr>' +
        "<td><h2>One</h2></td><td><p>Two</p></td>" +
        "<td><p>Three</p></td><td><p>Four</p></td>" +
        "</tr></table>",
    );
    const section = theSection(blocks);

    // The block model tops out at three columns, so four cells merge into one
    // slot. Every cell's content survives; only the layout is lost.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((block) => block.type)).toEqual([
      "title",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);

    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0]).toEqual({
      sourceTag: "tr",
      templaticalBlockType: "section",
      status: "approximated",
      note: "Row of 4 cells was merged into a single column. Templatical sections hold at most 3 columns.",
    });

    // The document-level warning is unchanged: a warning is context for the
    // whole import, the entry is the per-block fact, and both have readers.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("4 columns");
  });

  it("a flattened nested multi-cell row reports the columns it lost", () => {
    // A nested layout table sitting beside a heading is not packaging, so the
    // cell walker flattens it. Templatical forbids a section inside a column,
    // so the flattening is forced — the columns are still gone.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>' +
        "<h2>Cell heading</h2>" +
        '<table role="presentation"><tr>' +
        "<td><p>Inner left.</p></td>" +
        "<td><p>Inner right.</p></td>" +
        "</tr></table>" +
        "</td></tr></table>",
    );
    const section = theSection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((block) => block.type)).toEqual([
      "title",
      "paragraph",
      "paragraph",
    ]);

    const flattened = entries.filter(
      (entry) => entry.status === "approximated",
    );
    expect(flattened).toHaveLength(1);
    expect(flattened[0]).toEqual({
      sourceTag: "tr",
      templaticalBlockType: null,
      status: "approximated",
      note: "Nested row of 2 cells lost its columns. A Templatical section cannot nest inside a column, so its cells were merged into the surrounding column.",
    });
  });

  it("a flattened nested single-cell row loses nothing and reports nothing", () => {
    // The negative control for the case above: one cell has no columns to
    // lose, so a nested single-cell row must not report a downgrade.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>' +
        "<h2>Cell heading</h2>" +
        '<table role="presentation"><tr><td><p>Inner copy.</p></td></tr></table>' +
        "</td></tr></table>",
    );
    const section = theSection(blocks);

    expect(section.children[0].map((block) => block.type)).toEqual([
      "title",
      "paragraph",
    ]);
    expect(entries.filter((entry) => entry.status === "approximated")).toEqual(
      [],
    );
    expect(entries.map((entry) => entry.sourceTag)).toEqual(["h2", "p", "tr"]);
  });

  it("a wrapper row descended through contributes no section entry", () => {
    // The wrapper emits no section, so it has nothing to report; the layout
    // row it descends to reports the section that is actually created.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>' +
        '<table role="presentation"><tr>' +
        "<td><h2>Left heading</h2></td>" +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>" +
        "</td></tr></table>",
    );
    const section = theSection(blocks);

    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);

    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].status).toBe("converted");
    expect("note" in sectionEntries[0]).toBe(false);
  });

  it("a data table preserved as HTML produces no section entry", () => {
    // The fallback replaces the whole table with one html block, so there is
    // no section to account for.
    const { entries } = runTable(
      "<table><tr><td>Name</td><td>Age</td></tr><tr><td>Ada</td><td>30</td></tr></table>",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].templaticalBlockType).toBe("html");
    expect(
      entries.filter((entry) => entry.templaticalBlockType === "section"),
    ).toEqual([]);
  });
});

describe("extractCellBlocks — a container in a cell is descended to its table", () => {
  /** A one-cell-per-row layout table, the shape a column wrapper holds. */
  const columnTable =
    '<table role="presentation">' +
    "<tr><td><h2>Column heading</h2></td></tr>" +
    "<tr><td><p>Column copy.</p></td></tr>" +
    "</table>";

  it("descends a <div> wrapping a layout table instead of reading it as text", () => {
    const { blocks, entries } = runCell(`<div>${columnTable}</div>`);

    // The container carries no block of its own, so the cell's blocks are the
    // table's leaves. The hazard: `div` is a text tag in the block mapper, so
    // handing the container to `convertElement` emits one paragraph whose
    // content is the entire table subtree as raw markup.
    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);

    const heading = blocks[0];
    const copy = blocks[1];
    if (heading.type !== "title" || copy.type !== "paragraph")
      throw new Error("expected a title and a paragraph");
    expect(heading.content).toBe("<p>Column heading</p>");
    expect(copy.content).toBe("<p>Column copy.</p>");

    // A descended container contributes no entry of its own, matching a
    // descended wrapper row: nothing is created and nothing is lost. The
    // trailing `tr` is the section the outer wrapper row emits.
    expect(
      entries.map((entry) => [entry.sourceTag, entry.templaticalBlockType]),
    ).toEqual([
      ["h2", "title"],
      ["p", "paragraph"],
      ["tr", "section"],
    ]);
  });

  it("flattens a multi-column table a container hides", () => {
    // The outer row carries two content cells, which is what keeps the
    // container inside a column: a row whose single cell holds nothing but a
    // container of layout tables is packaging, and its layout row becomes a
    // section in its own right.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr>' +
        '<td><div><table role="presentation"><tr>' +
        "<td><h2>Left heading</h2></td>" +
        "<td><p>Right copy.</p></td>" +
        "</tr></table></div></td>" +
        "<td><p>Second column.</p></td>" +
        "</tr></table>",
    );

    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);

    // Templatical forbids a section inside a column, so a table reached from
    // a cell flattens however many containers deep it sits — its blocks land
    // in the column the container sat in, in source order.
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["title", "paragraph"], ["paragraph"]],
    );
    expect(section.children.flat().some((b) => b.type === "section")).toBe(
      false,
    );

    const flattened = entries.filter(
      (entry) => entry.templaticalBlockType === null,
    );
    expect(flattened).toHaveLength(1);
    expect(flattened[0].sourceTag).toBe("tr");
    expect(flattened[0].status).toBe("approximated");
    expect(flattened[0].note).toBe(
      "Nested row of 2 cells lost its columns. A Templatical section cannot nest inside a column, so its cells were merged into the surrounding column.",
    );
  });

  it("descends every container a cell holds, in source order", () => {
    // The compiled-MJML shape: one wrapper div per column, siblings in a
    // single cell. Each becomes a paragraph of raw markup without the descent.
    const { blocks } = runCell(
      '<div><table role="presentation"><tr><td><h2>First</h2></td></tr></table></div>' +
        '<div><table role="presentation"><tr><td><h2>Second</h2></td></tr></table></div>',
    );

    expect(blocks.map((b) => b.type)).toEqual(["title", "title"]);
    expect(blocks.map((b) => (b.type === "title" ? b.content : null))).toEqual([
      "<p>First</p>",
      "<p>Second</p>",
    ]);
  });

  it("descends a container nested inside another container", () => {
    const { blocks } = runCell(`<div><div>${columnTable}</div></div>`);

    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
  });

  it("descends <center> and <main> the same way as <div>", () => {
    for (const tag of ["center", "main"]) {
      const { blocks } = runCell(`<${tag}>${columnTable}</${tag}>`);
      expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
    }
  });

  it("keeps an element sitting beside the table inside a container", () => {
    const { blocks } = runCell(
      `<div><h2>Beside the table</h2>${columnTable}</div>`,
    );

    // Descending a container discards nothing: its non-table children are
    // converted in place, so a heading beside the table survives in order.
    expect(blocks.map((b) => b.type)).toEqual(["title", "title", "paragraph"]);
    const aside = blocks[0];
    if (aside.type !== "title") throw new Error("expected title block");
    expect(aside.content).toBe("<p>Beside the table</p>");
  });

  it("keeps bare text sitting beside the table inside a container", () => {
    const { blocks, entries } = runCell(
      `<div>Lead-in text.${columnTable}</div>`,
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "title",
      "paragraph",
    ]);
    const lead = blocks[0];
    if (lead.type !== "paragraph") throw new Error("expected paragraph block");
    expect(lead.content).toBe("<p>Lead-in text.</p>");

    // The run is styled by, and reported against, the container it sits in —
    // the nearest element that could carry a colour, size or alignment.
    expect(entries[0].sourceTag).toBe("div");
    expect(entries[0].templaticalBlockType).toBe("paragraph");
  });

  it("keeps a container holding no table as one paragraph", () => {
    const { blocks, entries } = runCell(
      '<div style="color:#334455">Just prose, no table.</div>',
    );

    // The negative control for the descent. `div` is a text tag, so a
    // container of copy must keep that mapping rather than being split into a
    // block per child.
    expect(blocks.map((b) => b.type)).toEqual(["paragraph"]);
    const copy = blocks[0];
    if (copy.type !== "paragraph") throw new Error("expected paragraph block");
    expect(copy.content).toBe(
      '<p><span style="color: #334455">Just prose, no table.</span></p>',
    );
    expect(entries[0].sourceTag).toBe("div");
    expect(entries[0].templaticalBlockType).toBe("paragraph");
    expect(entries[0].status).toBe("converted");
  });

  it("keeps an unknown element holding a table as an html fallback", () => {
    const { blocks, entries } = runCell(`<section>${columnTable}</section>`);

    // The descent is gated on the container tag set, not on holding a table:
    // widening it to every element would turn a tag with no mapping into a
    // silent traversal step and lose its markup.
    expect(blocks.map((b) => b.type)).toEqual(["html"]);
    expect(entries[0].sourceTag).toBe("section");
    expect(entries[0].status).toBe("html-fallback");
  });
});

describe("processTable — a container does not hide a wrapper cell's layout row", () => {
  /** A two-column layout row, as the markup a wrapper hides. */
  const twoColumnTable =
    '<table role="presentation"><tr>' +
    "<td><h2>Left heading</h2></td>" +
    "<td><p>Right copy.</p></td>" +
    "</tr></table>";

  function onlySection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  function expectTwoColumns(section: SectionBlock): void {
    // "2" is off the section factory's default, and the slot count is what
    // says the columns are real rather than a relabelled single column.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["title"], ["paragraph"]],
    );
    const heading = section.children[0][0];
    const copy = section.children[1][0];
    if (heading.type !== "title" || copy.type !== "paragraph")
      throw new Error("expected a title and a paragraph");
    expect(heading.content).toBe("<p>Left heading</p>");
    expect(copy.content).toBe("<p>Right copy.</p>");
  }

  it("descends a <center> sitting between the wrapper cell and its table", () => {
    const { blocks, warnings } = runTable(
      '<table role="presentation"><tr><td>' +
        `<center>${twoColumnTable}</center>` +
        "</td></tr></table>",
    );

    expectTwoColumns(onlySection(blocks));
    expect(warnings).toEqual([]);
  });

  it("descends <div> and <main> the same way as <center>", () => {
    for (const tag of ["div", "main"]) {
      const { blocks } = runTable(
        '<table role="presentation"><tr><td>' +
          `<${tag}>${twoColumnTable}</${tag}>` +
          "</td></tr></table>",
      );
      expectTwoColumns(onlySection(blocks));
    }
  });

  it("descends a container nested inside another container", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        `<div><center>${twoColumnTable}</center></div>` +
        "</td></tr></table>",
    );

    expectTwoColumns(onlySection(blocks));
  });

  it("descends a container holding a wrapper table around the layout row", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td><center>' +
        `<table role="presentation"><tr><td>${twoColumnTable}</td></tr></table>` +
        "</center></td></tr></table>",
    );

    expectTwoColumns(onlySection(blocks));
  });

  it("descends into every table a container holds, in source order", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td><center>' +
        twoColumnTable +
        '<table role="presentation"><tr><td><p>Footer copy.</p></td></tr></table>' +
        "</center></td></tr></table>",
    );

    expect(blocks.map((b) => b.type)).toEqual(["section", "section"]);
    const [first, second] = blocks as SectionBlock[];
    expect([first.columns, second.columns]).toEqual(["2", "1"]);
    expect([first.children.length, second.children.length]).toEqual([2, 1]);
    const footer = second.children[0][0];
    if (footer.type !== "paragraph") throw new Error("expected paragraph");
    expect(footer.content).toBe("<p>Footer copy.</p>");
  });

  it("keeps a container holding prose beside its table", () => {
    // The receipt shape from the corpus: a typography wrapper holding copy and
    // then a table. Descending discards the wrapper, so the copy would go with
    // it — the row has to stay the section it already is.
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        `<div class="f-fallback"><p>Lead-in copy.</p>${twoColumnTable}</div>` +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "title",
      "paragraph",
    ]);
    const lead = section.children[0][0];
    if (lead.type !== "paragraph") throw new Error("expected paragraph block");
    expect(lead.content).toBe("<p>Lead-in copy.</p>");
  });

  it("keeps a container holding bare text beside its table", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        `<center>Lead-in text.${twoColumnTable}</center>` +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "title",
      "paragraph",
    ]);
  });

  it("keeps a styled wrapper row whose container hides a layout row", () => {
    const { blocks } = runTable(
      '<table role="presentation">' +
        '<tr style="background-color:#123456;padding:12px"><td>' +
        `<center>${twoColumnTable}</center>` +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    // The row-level guard is unchanged by the container descent: the section
    // is the only carrier for a row's background and padding.
    expect(section.columns).toBe("1");
    expect(section.styles.backgroundColor).toBe("#123456");
    expect(section.styles.padding).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
    });
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
  });

  it("descends a wrapper cell that is a <th>", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><th>' +
        `<center>${twoColumnTable}</center>` +
        "</th></tr></table>",
    );

    expectTwoColumns(onlySection(blocks));
  });

  it("keeps a container holding no table as one paragraph", () => {
    // The negative control for the descent: the container test is what stops
    // it widening into "descend every div", and `div` is a text tag.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>' +
        '<div style="color:#334455">Just prose, no table.</div>' +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children[0].map((b) => b.type)).toEqual(["paragraph"]);
    const copy = section.children[0][0];
    if (copy.type !== "paragraph") throw new Error("expected paragraph block");
    expect(copy.content).toBe(
      '<p><span style="color: #334455">Just prose, no table.</span></p>',
    );
    expect(entries[0].sourceTag).toBe("div");
  });

  it("keeps an unknown element holding a table as an html fallback", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        `<section>${twoColumnTable}</section>` +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    // Gated on the container tag set, not on holding a table: widening it
    // would turn a tag with no mapping into a silent traversal step.
    expect(section.columns).toBe("1");
    expect(section.children[0].map((b) => b.type)).toEqual(["html"]);
  });

  it("flattens a container-wrapped layout row reached from a parent cell", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        `<center>${twoColumnTable}</center>` +
        "</td></tr></table>",
      true,
    );

    // Templatical forbids a section inside a column, so the descent keeps
    // flattening however many containers deep the table sits.
    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph"]);
    expect(blocks.some((b) => b.type === "section")).toBe(false);
  });

  it("keeps a container whose markup states no columns as one section", () => {
    // Compiled MJML's shape: a column is a container holding a table whose
    // rows are stacked blocks, not columns. Descending it promotes each of
    // those rows to a section and shatters the source's own section into one
    // per block, buying no column count in exchange.
    const { blocks } = runTable(
      '<table role="presentation"><tr><td><div>' +
        '<table role="presentation">' +
        "<tr><td><div><h3>First</h3></div></td></tr>" +
        "<tr><td><div><p>Second.</p></div></td></tr>" +
        "</table>" +
        "</div></td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    // Each row's own `<div>` holds no table, so it is correctly not a
    // container to descend — the block mapper unwraps it instead, which is
    // what types the heading it wraps without promoting the row to a section.
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
    const first = section.children[0][0];
    if (first.type !== "title") throw new Error("expected title block");
    // `level: 3` is off the title factory's default (2), so this cannot pass
    // on a default that merely survived.
    expect(first.level).toBe(3);
    expect(first.content).toBe("<p>First</p>");
  });

  it("keeps one section when a cell holds one container per column", () => {
    // The same shape with two columns: sibling containers in a single cell
    // are parallel content, so the row they sit in is the section — the cells
    // never stated a count for the descent to recover.
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        '<div><table role="presentation"><tr><td><h2>Left</h2></td></tr></table></div>' +
        '<div><table role="presentation"><tr><td><p>Right.</p></td></tr></table></div>' +
        "</td></tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
  });

  it("reports the descended container's row as one converted section", () => {
    const { entries } = runTable(
      '<table role="presentation"><tr><td>' +
        `<center>${twoColumnTable}</center>` +
        "</td></tr></table>",
    );

    // Neither the wrapper row nor the container creates a block, so only the
    // layout row reports a section.
    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].sourceTag).toBe("tr");
    expect(sectionEntries[0].status).toBe("converted");
    expect("note" in sectionEntries[0]).toBe(false);
    expect(entries.map((entry) => entry.sourceTag)).toEqual(["h2", "p", "tr"]);
  });
});

describe("processTable — a row of blank cells around one is a centring device", () => {
  function onlySection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  it("reads the most-copied template's nbsp gutters as one column", () => {
    // leemunroe/responsive-html-email-template's body row: two `&nbsp;`
    // gutters centring one content cell. Read as three columns, the whole
    // email renders in the middle third.
    const { blocks, warnings } = runTable(
      '<table role="presentation"><tr>' +
        '<td valign="top">&nbsp;</td>' +
        '<td class="container"><h2>The email</h2><p>Body copy.</p></td>' +
        '<td valign="top">&nbsp;</td>' +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "paragraph",
    ]);
    const heading = section.children[0][0];
    if (heading.type !== "title") throw new Error("expected title block");
    expect(heading.content).toBe("<p>The email</p>");
    expect(warnings).toEqual([]);
  });

  it("reads a Foundation expander cell as one column", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        "<th><h2>The content</h2></th>" +
        '<th class="expander"></th>' +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
  });

  it("drops a blank cell that states a height instead of stacking its spacer", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        '<td height="20">&nbsp;</td>' +
        "<td><h2>The content</h2></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // A gutter's height is horizontal chrome. Merging the cells instead would
    // put a spacer block above the content that the source never had.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
  });

  it("reads gutters on both sides of a four-cell row without warning", () => {
    const { blocks, warnings } = runTable(
      '<table role="presentation"><tr>' +
        "<td>&nbsp;</td><td>&nbsp;</td>" +
        "<td><h2>The content</h2></td>" +
        "<td>&nbsp;</td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // No layout was flattened, so the four-column warning must not fire.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
    expect(warnings).toEqual([]);
  });

  it("reports a centring row as one converted column", () => {
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr>' +
        "<td>&nbsp;</td>" +
        "<td><h2>The content</h2></td>" +
        "<td>&nbsp;</td>" +
        "</tr></table>",
    );

    // Read as three columns the row also reports `converted`, because three
    // cells fill three slots — so the entry assertion below says nothing
    // without the layout pinned beside it.
    const section = onlySection(blocks);
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);

    const sectionEntries = entries.filter(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].sourceTag).toBe("tr");
    // Nothing was merged: the gutters were never columns, so the entry must
    // not claim the three-column collapse.
    expect(sectionEntries[0].status).toBe("converted");
    expect("note" in sectionEntries[0]).toBe(false);
  });

  it("reports nothing for a centring row flattened into a parent column", () => {
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr>' +
        "<td>&nbsp;</td>" +
        "<td><h2>The content</h2></td>" +
        "<td>&nbsp;</td>" +
        "</tr></table>",
      true,
    );

    expect(blocks.map((b) => b.type)).toEqual(["title"]);
    // One column has no columns to lose, so the flattening downgrade note
    // must not fire for a centring row either.
    expect(entries.filter((entry) => entry.status === "approximated")).toEqual(
      [],
    );
  });

  it("keeps a genuine two-column row", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        "<td><h2>Left heading</h2></td>" +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["title"], ["paragraph"]],
    );
  });

  it("keeps a genuine three-column row", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        "<td><p>One</p></td><td><p>Two</p></td><td><p>Three</p></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children.map((column) => column.length)).toEqual([1, 1, 1]);
  });

  it("keeps three columns when only one of them is blank", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        "<td><p>One</p></td><td><p>Two</p></td><td>&nbsp;</td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // Two cells carry content, so this is a grid with an empty slot rather
    // than a centring device — collapsing it would re-flow the two filled
    // columns from thirds to halves.
    expect(section.columns).toBe("3");
    expect(section.children).toHaveLength(3);
    expect(section.children.map((column) => column.length)).toEqual([1, 1, 0]);
  });

  it("counts an image-only cell as a column", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        '<td><img src="https://example.com/a.png" alt=""></td>' +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // Emptiness is about what a reader sees, not about text: an image or a
    // link carries no text and is content all the same.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.map((b) => b.type))).toEqual(
      [["image"], ["paragraph"]],
    );
  });

  it("counts a link-only cell as a column", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        '<td><a href="https://example.com"><img src="https://example.com/a.png" alt=""></a></td>' +
        "<td><p>Right copy.</p></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children[0]).toHaveLength(1);
    expect(section.children[1]).toHaveLength(1);
  });

  it("leaves a single-cell spacer row alone", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td height="24">&nbsp;</td></tr>' +
        "<tr><td><p>Copy.</p></td></tr></table>",
    );

    // The rule needs a cell to be a gutter *of*, so a one-cell row keeps its
    // spacer: a row on its own is vertical space, not chrome beside content.
    expect(blocks.map((b) => b.type)).toEqual(["section", "section"]);
    const [spacerRow] = blocks as SectionBlock[];
    expect(spacerRow.columns).toBe("1");
    expect(spacerRow.children[0].map((b) => b.type)).toEqual(["spacer"]);
    const spacer = spacerRow.children[0][0];
    if (spacer.type !== "spacer") throw new Error("expected spacer block");
    expect(spacer.height).toBe(24);
  });

  it("leaves a row of nothing but blank cells alone", () => {
    // The content row is what makes this a layout table at all: a table whose
    // cells hold only `&nbsp;` is a data table and never reaches a section.
    const { blocks } = runTable(
      '<table role="presentation">' +
        '<tr><td height="20">&nbsp;</td><td height="20">&nbsp;</td></tr>' +
        "<tr><td><p>Copy.</p></td></tr>" +
        "</table>",
    );

    expect(blocks.map((b) => b.type)).toEqual(["section", "section"]);
    const [blankRow] = blocks as SectionBlock[];

    // Cells of a row sit side by side, so a row with no content anywhere
    // states one gap per column rather than a stack of them. Merging would
    // add their heights and invent vertical space.
    expect(blankRow.columns).toBe("2");
    expect(blankRow.children).toHaveLength(2);
    expect(
      blankRow.children.map((column) => column.map((b) => b.type)),
    ).toEqual([["spacer"], ["spacer"]]);
  });
});

describe("processTable — the container descent and the centring rule together", () => {
  // Foundation-derived markup needs both rules at once, and either alone
  // reads it wrongly:
  //
  // - Without the container descent, the `<center>` hides the layout table
  //   and the whole subtree collapses into one column, columns and all.
  // - Without the centring rule, the descent turns each `expander` cell into
  //   a real column holding nothing but a spacer, so a one-column row imports
  //   as two columns — worse than the collapse it replaced.
  //
  // The `line-height` on the expander is what Foundation's own stylesheet
  // resolves onto it, and it is what makes the phantom spacer real.
  const foundationRow =
    "<tr>" +
    "<th><h2>Masthead</h2></th>" +
    '<th class="expander" style="line-height:20px"></th>' +
    "</tr>";
  const genuineRow =
    "<tr>" +
    "<th><p>Left copy.</p></th>" +
    "<th><p>Right copy.</p></th>" +
    "</tr>";

  it("yields a clean one-column section beside the genuine two-column row", () => {
    const { blocks, warnings } = runTable(
      '<table role="presentation"><tr><td><center>' +
        `<table role="presentation">${foundationRow}${genuineRow}</table>` +
        "</center></td></tr></table>",
    );

    expect(blocks.map((b) => b.type)).toEqual(["section", "section"]);
    const [centred, genuine] = blocks as SectionBlock[];

    // The descent is what produces two sections at all; the centring rule is
    // what keeps the first of them one column with no spacer in it.
    expect(centred.columns).toBe("1");
    expect(centred.children).toHaveLength(1);
    expect(centred.children[0].map((b) => b.type)).toEqual(["title"]);

    expect(genuine.columns).toBe("2");
    expect(genuine.children).toHaveLength(2);
    expect(genuine.children.map((column) => column.map((b) => b.type))).toEqual(
      [["paragraph"], ["paragraph"]],
    );

    expect(warnings).toEqual([]);
    expect(
      blocks.flatMap((b) =>
        b.type === "section" ? b.children.flat().map((c) => c.type) : [b.type],
      ),
    ).toEqual(["title", "paragraph", "paragraph"]);
  });
});

describe("processTable — declared widths choose between same-count layouts", () => {
  function onlySection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  /** A two-cell layout row, each cell carrying one heading. */
  function twoCellRow(first: string, second: string): string {
    return (
      '<table role="presentation"><tr>' +
      `<td ${first}><h2>Left</h2></td>` +
      `<td ${second}><h2>Right</h2></td>` +
      "</tr></table>"
    );
  }

  /** A three-cell layout row, each cell carrying one heading. */
  function threeCellRow(attrs: string[]): string {
    return (
      '<table role="presentation"><tr>' +
      attrs.map((a, i) => `<td ${a}><h2>Cell ${i}</h2></td>`).join("") +
      "</tr></table>"
    );
  }

  function sectionEntriesOf(entries: ImportReportEntry[]): ImportReportEntry[] {
    return entries.filter((entry) => entry.templaticalBlockType === "section");
  }

  it("reads a mailchimp 350/190 sidebar row as 2-1", () => {
    const { blocks, entries, warnings } = runTable(
      twoCellRow('width="350"', 'width="190"'),
    );
    const section = onlySection(blocks);

    // 64.8 / 35.2 is 1.9pp from 2-1 and 14.8pp from an equal split, so the
    // asymmetry is unambiguous. The count still comes from the two cells.
    expect(section.columns).toBe("2-1");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
    expect(section.children[1].map((b) => b.type)).toEqual(["title"]);

    // Recovering the ratio loses nothing, so the row reports no downgrade.
    const sectionEntries = sectionEntriesOf(entries);
    expect(sectionEntries).toHaveLength(1);
    expect(sectionEntries[0].status).toBe("converted");
    expect("note" in sectionEntries[0]).toBe(false);
    expect(warnings).toEqual([]);
  });

  it("reads the mirrored 190/350 row as 1-2", () => {
    const { blocks } = runTable(twoCellRow('width="190"', 'width="350"'));
    const section = onlySection(blocks);

    expect(section.columns).toBe("1-2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
  });

  it("reads Cerberus's 33.33% / 66.66% percentages as 1-2", () => {
    const { blocks } = runTable(
      twoCellRow('style="width:33.33%"', 'style="width:66.66%"'),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1-2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
  });

  it("keeps an equal declared split as 2 with no downgrade reported", () => {
    const { blocks, entries } = runTable(
      twoCellRow('width="280"', 'width="280"'),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("keeps equal declared thirds as 3", () => {
    const { blocks, entries } = runTable(
      threeCellRow([
        'style="width:33.33%"',
        'style="width:33.33%"',
        'style="width:33.33%"',
      ]),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("3");
    expect(section.children.map((column) => column.length)).toEqual([1, 1, 1]);
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
  });

  it("leaves a row with no declared widths at its counted layout", () => {
    const { blocks, entries } = runTable(twoCellRow("", ""));
    const section = onlySection(blocks);

    // Nothing was observed, so there is no ratio to name and no downgrade.
    expect(section.columns).toBe("2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("reports an 80/20 split as an approximation naming the observed ratio", () => {
    const { blocks, entries } = runTable(
      twoCellRow('width="80%"', 'width="20%"'),
    );
    const section = onlySection(blocks);

    // 13.3pp from 2-1 and 30pp from an equal split: outside tolerance, so the
    // counted layout stands and the loss is named.
    expect(section.columns).toBe("2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    const entry = sectionEntriesOf(entries)[0];
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      "Column widths 80% / 20% have no Templatical equivalent. The section was imported as 2 equal columns.",
    );
  });

  it("reports a 130/280/130 row as an approximation naming the observed ratio", () => {
    const { blocks, entries } = runTable(
      threeCellRow(['width="130"', 'width="280"', 'width="130"']),
    );
    const section = onlySection(blocks);

    // Templatical has no 1-2-1 layout, so equal thirds is the closest the
    // model can express and the report says so.
    expect(section.columns).toBe("3");
    expect(section.children.map((column) => column.length)).toEqual([1, 1, 1]);
    const entry = sectionEntriesOf(entries)[0];
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      "Column widths 24.1% / 51.9% / 24.1% have no Templatical equivalent. The section was imported as 3 equal columns.",
    );
  });

  it("derives no ratio from a partial declaration", () => {
    const { blocks, entries } = runTable(twoCellRow('width="190"', ""));
    const section = onlySection(blocks);

    // One share of an unknown total states no ratio.
    expect(section.columns).toBe("2");
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("derives no ratio from widths in mixed units", () => {
    const { blocks, entries } = runTable(
      twoCellRow('width="350"', 'width="50%"'),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("2");
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("treats a declared 100% as no signal at all", () => {
    const { blocks, entries } = runTable(
      twoCellRow('style="width:100%"', 'style="width:100%"'),
    );
    const section = onlySection(blocks);

    // Two cells each claiming the whole row is not a 50/50 declaration — it
    // is the absence of one. Normalising it would read every such row as an
    // equal split and, worse, would read one 100% cell beside a 200px cell as
    // a 33/67 ratio.
    expect(section.columns).toBe("2");
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("derives no ratio from a 100% width beside a real one", () => {
    const { blocks, entries } = runTable(
      twoCellRow('style="width:100%"', 'style="width:33%"'),
    );
    const section = onlySection(blocks);

    // Accepting the 100% would normalise this to 75 / 25 and report the row
    // as a downgrade it never was. Two cells both claiming 100% would hide
    // that, normalising to an equal split and reaching the right answer for
    // the wrong reason.
    expect(section.columns).toBe("2");
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });

  it("reports the merge, not the ratio, when a row exceeds three columns", () => {
    const { blocks, entries, warnings } = runTable(
      '<table role="presentation"><tr>' +
        '<td width="300"><h2>A</h2></td>' +
        '<td width="100"><h2>B</h2></td>' +
        '<td width="100"><h2>C</h2></td>' +
        '<td width="100"><h2>D</h2></td>' +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // The columns are gone, so naming their ratio would describe a layout the
    // section does not have.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "title",
      "title",
      "title",
    ]);
    const entry = sectionEntriesOf(entries)[0];
    expect(entry.status).toBe("approximated");
    expect(entry.note).toBe(
      "Row of 4 cells was merged into a single column. Templatical sections hold at most 3 columns.",
    );
    expect(warnings).toHaveLength(1);
  });

  it("reads no ratio from a centring row's declared gutters", () => {
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr>' +
        '<td width="20">&nbsp;</td>' +
        '<td width="560"><h2>The email</h2></td>' +
        '<td width="20">&nbsp;</td>' +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // The gutters were never columns, so the row has one column and no ratio
    // to choose. Reading widths off every cell instead would find a declared
    // 3.3 / 93.3 / 3.3 split and report the centring device as a downgrade.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
    expect(sectionEntriesOf(entries)[0].status).toBe("converted");
    expect("note" in sectionEntriesOf(entries)[0]).toBe(false);
  });
});

describe("processTable — sibling column divs in one cell are a column set", () => {
  function onlySection(blocks: Block[]): SectionBlock {
    expect(blocks).toHaveLength(1);
    const section = blocks[0];
    if (section.type !== "section") throw new Error("expected section block");
    return section;
  }

  /** A column div in Cerberus's hybrid shape, holding one heading. */
  function stackColumn(style: string, label: string): string {
    return (
      `<div class="stack-column" style="display:inline-block; vertical-align:top; ${style}">` +
      `<table role="presentation"><tr><td><h2>${label}</h2></td></tr></table>` +
      "</div>"
    );
  }

  function cellRow(inner: string, cellAttrs = ""): string {
    return `<table role="presentation"><tr><td ${cellAttrs}>${inner}</td></tr></table>`;
  }

  it("reads Cerberus's 220/440 max-widths as a 1-2 column set", () => {
    const { blocks } = runTable(
      cellRow(
        stackColumn("max-width: 220px; width:100%;", "Narrow") +
          stackColumn("max-width: 440px;", "Wide"),
      ),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("1-2");
    expect(section.children).toHaveLength(2);
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
    expect(section.children[1].map((b) => b.type)).toEqual(["title"]);
    const narrow = section.children[0][0];
    const wide = section.children[1][0];
    if (narrow.type !== "title" || wide.type !== "title")
      throw new Error("expected title blocks");
    expect(narrow.content).toBe("<p>Narrow</p>");
    expect(wide.content).toBe("<p>Wide</p>");
  });

  it("reads a compiled-MJML column class over its width:100% style", () => {
    const { blocks } = runTable(
      cellRow(
        '<div class="mj-column-per-66-67 mj-outlook-group-fix" style="display:inline-block;vertical-align:top;width:100%;">' +
          '<table role="presentation"><tr><td><h2>Main</h2></td></tr></table>' +
          "</div>" +
          '<div class="mj-column-per-33-33 mj-outlook-group-fix" style="display:inline-block;vertical-align:top;width:100%;">' +
          '<table role="presentation"><tr><td><h2>Aside</h2></td></tr></table>' +
          "</div>",
      ),
    );
    const section = onlySection(blocks);

    // The class is the only signal here: every compiled column div also
    // carries `width:100%`, which states no share of its row. Without the
    // class reader the row falls back to its counted layout and every MJML
    // asymmetry imports as an equal split.
    expect(section.columns).toBe("2-1");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
  });

  it("reads three equal column divs as a 3 column set", () => {
    const { blocks, entries } = runTable(
      cellRow(
        stackColumn("max-width: 220px; width:100%;", "One") +
          stackColumn("max-width: 220px; width:100%;", "Two") +
          stackColumn("max-width: 220px; width:100%;", "Three"),
      ),
    );
    const section = onlySection(blocks);

    expect(section.columns).toBe("3");
    expect(section.children.map((column) => column.length)).toEqual([1, 1, 1]);
    const sectionEntry = entries.find(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntry?.status).toBe("converted");
  });

  it("counts the divs even when none declares a width", () => {
    const { blocks, entries } = runTable(
      cellRow(stackColumn("", "Left") + stackColumn("", "Right")),
    );
    const section = onlySection(blocks);

    // Side-by-side is what makes them columns; the width only chooses between
    // layouts of the same count.
    expect(section.columns).toBe("2");
    expect(section.children.map((column) => column.length)).toEqual([1, 1]);
    const sectionEntry = entries.find(
      (entry) => entry.templaticalBlockType === "section",
    );
    expect(sectionEntry?.status).toBe("converted");
    expect(sectionEntry && "note" in sectionEntry).toBe(false);
  });

  it("leaves stacked divs that are not laid out side by side alone", () => {
    const { blocks } = runTable(
      cellRow(
        '<div><table role="presentation"><tr><td><h2>One</h2></td></tr></table></div>' +
          '<div><table role="presentation"><tr><td><h2>Two</h2></td></tr></table></div>',
      ),
    );
    const section = onlySection(blocks);

    // Two block-level divs stack vertically. Reading them as columns would
    // invent a layout the source never stated.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title", "title"]);
  });

  it("refuses a column set in which any candidate is blank", () => {
    const { blocks } = runTable(
      cellRow(
        stackColumn("max-width: 220px;", "Only content") +
          '<div class="stack-column" style="display:inline-block; max-width: 440px;">&nbsp;</div>',
      ),
    );
    const section = onlySection(blocks);

    // A two-column section with an empty slot is worse than the one column a
    // cell count already gives.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["title"]);
  });

  it("refuses a cell holding content beside the column divs", () => {
    const { blocks } = runTable(
      cellRow(
        "<h1>Section heading</h1>" +
          stackColumn("max-width: 220px;", "Left") +
          stackColumn("max-width: 440px;", "Right"),
      ),
    );
    const section = onlySection(blocks);

    // The heading belongs to neither column, and promoting the divs would
    // have to put it in one of them.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "title",
      "title",
    ]);
  });

  it("refuses a cell holding bare text beside the column divs", () => {
    const { blocks } = runTable(
      cellRow(
        "A line of its own. " +
          stackColumn("max-width: 220px;", "Left") +
          stackColumn("max-width: 440px;", "Right"),
      ),
    );
    const section = onlySection(blocks);

    // The sentence belongs to neither column. Reading the divs as columns
    // anyway would have to place it in one of them or lose it.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "paragraph",
      "title",
      "title",
    ]);
    const line = section.children[0][0];
    if (line.type !== "paragraph") throw new Error("expected paragraph block");
    expect(line.content).toBe("<p>A line of its own. </p>");
  });

  it("refuses a column set with a side-by-side non-container beside it", () => {
    const { blocks } = runTable(
      cellRow(
        stackColumn("max-width: 220px;", "Left") +
          stackColumn("max-width: 440px;", "Right") +
          '<a href="https://x/cta" style="display:inline-block; padding:10px;">Act now</a>',
      ),
    );
    const section = onlySection(blocks);

    // The anchor is laid out beside the columns and is not one, so requiring
    // every child to be a container is what keeps it out of a column. Only
    // checking the display property would admit it and lose it into the last
    // column's slot.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual([
      "title",
      "title",
      "button",
    ]);
  });

  it("leaves a lone container to the cell walk that wraps it", () => {
    const { blocks } = runTable(
      cellRow(
        '<div style="display:inline-block;">' +
          '<a href="https://x/cta">Act now</a>' +
          "</div>",
        'style="padding:10px; background-color:#ff0000"',
      ),
    );
    const section = onlySection(blocks);

    // One container is not a column set. Promoting it would take the content
    // walk and bypass the cell's own button classification, which reads the
    // styling table-based email wraps a call to action in.
    expect(section.columns).toBe("1");
    expect(section.children).toHaveLength(1);
    expect(section.children[0].map((b) => b.type)).toEqual(["button"]);
    const button = section.children[0][0];
    if (button.type !== "button") throw new Error("expected button block");
    expect(button.url).toBe("https://x/cta");
    expect(button.backgroundColor).toBe("#ff0000");
  });

  it("emits one section for the row, never one per column", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr><td>' +
        stackColumn("max-width: 220px;", "Left") +
        stackColumn("max-width: 440px;", "Right") +
        "</td></tr>" +
        "<tr><td><h2>Below</h2></td></tr></table>",
    );

    // Promoting the divs must not turn the cell's tables into sections of
    // their own — the row is one section with two slots.
    expect(blocks).toHaveLength(2);
    const first = blocks[0];
    if (first.type !== "section") throw new Error("expected section block");
    expect(first.columns).toBe("1-2");
    expect(first.children.map((column) => column.length)).toEqual([1, 1]);
  });

  it("keeps a multi-cell row's cells as its columns", () => {
    const { blocks } = runTable(
      '<table role="presentation"><tr>' +
        "<td>" +
        stackColumn("max-width: 220px;", "Inner left") +
        stackColumn("max-width: 440px;", "Inner right") +
        "</td>" +
        "<td><h2>Right cell</h2></td>" +
        "</tr></table>",
    );
    const section = onlySection(blocks);

    // Columns inside a column are not representable, so the row's own cells
    // win and the inner set flattens into the first slot. Promoting it would
    // report a layout the section cannot hold.
    expect(section.columns).toBe("2");
    expect(section.children).toHaveLength(2);
    expect(section.children[0].map((b) => b.type)).toEqual(["title", "title"]);
    expect(section.children[1].map((b) => b.type)).toEqual(["title"]);
  });

  it("converts a promoted column's content the way a container is converted", () => {
    const { blocks } = runTable(
      cellRow(
        '<div class="stack-column" style="display:inline-block; max-width: 220px;">' +
          '<table role="presentation"><tr><td><a href="https://x/more">Read more</a></td></tr></table>' +
          "</div>" +
          stackColumn("max-width: 440px;", "Wide"),
      ),
    );
    const section = onlySection(blocks);

    // `looksLikeButton` answers true for `display: inline-block`, which every
    // column container carries — so handing one to the cell walk classifies a
    // column whose content is a link as a single button and drops the
    // column's own table. The link is prose here and stays in a paragraph.
    expect(section.columns).toBe("1-2");
    expect(section.children[0].map((b) => b.type)).toEqual(["paragraph"]);
    const link = section.children[0][0];
    if (link.type !== "paragraph") throw new Error("expected paragraph block");
    expect(link.content).toBe('<p><a href="https://x/more">Read more</a></p>');
  });

  it("gives every promoted column at least one block", () => {
    const { blocks } = runTable(
      cellRow(
        stackColumn("max-width: 220px;", "Left") +
          stackColumn("max-width: 440px;", "Right"),
      ),
    );
    const section = onlySection(blocks);

    expect(section.children.filter((column) => column.length === 0)).toEqual(
      [],
    );
  });
});
