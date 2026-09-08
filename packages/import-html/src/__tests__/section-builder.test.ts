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

    // The deeply-nested plain anchor flattened to an approximated paragraph.
    const para = column[1];
    if (para.type !== "paragraph") throw new Error("expected paragraph block");
    expect(para.content).toContain("inner plain link");

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

  it("still approximates a plain inline anchor as its own paragraph", () => {
    // The negative control on `a`: it is excluded from the inline set, so it
    // keeps its own entry rather than folding into the run beside it.
    const { blocks, entries } = runCell(
      'Click <a href="https://x.test/go">here</a> now',
    );

    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    const anchor = blocks[1];
    if (anchor.type !== "paragraph")
      throw new Error("expected paragraph block");
    expect(anchor.content).toBe("<p>here</p>");
    expect(entries[1]).toEqual({
      sourceTag: "a",
      templaticalBlockType: "paragraph",
      status: "approximated",
      note: "Inline anchor wrapped in a paragraph block.",
    });
  });

  it("keeps the words around a self-styled anchor and still emits its button", () => {
    // The other half of the `a` control. `isButtonCell` runs before any cell
    // walk, and a cell reads as a button only when the link is its entire
    // content — so this sentence takes the walk, the two bare text nodes
    // become runs of their own, and the styled anchor is still a button.
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

  it("still preserves a text-only cell as an html block", () => {
    // A cell with no element children at all takes the text-only path, which
    // reports the `<td>` itself. Structural, and owned by the deferred
    // detection work in spec §7 — not by the inline fold.
    const { blocks, entries } = runTable(
      '<table role="presentation"><tr><td>Just text</td></tr>' +
        '<tr><td><img src="https://x.test/a.jpg"></td></tr></table>',
    );

    expect(leaves(blocks).map((b) => b.type)).toEqual(["html", "image"]);
    expect(entries[0]).toEqual({
      sourceTag: "td",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: 'Unknown element "td" preserved as HTML block.',
    });
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

    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    const contents = blocks.map((block) =>
      block.type === "paragraph" ? block.content : "",
    );
    expect(contents[1]).toBe("<p>terms</p>");
    expect(contents.join(" ")).toContain("Read the");
    expect(contents.join(" ")).toContain("before you continue");
    expect(entries.map((e) => e.templaticalBlockType)).toEqual([
      "paragraph",
      "paragraph",
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
