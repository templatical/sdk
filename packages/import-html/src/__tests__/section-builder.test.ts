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

/** Wraps `inner` in a single-cell layout table and returns the cell's blocks. */
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
    expect(entries).toHaveLength(1);
  });

  it("emits nothing for a run of nbsp and line breaks", () => {
    const { blocks, entries } = runCell("&nbsp;<br><br><h3>Only</h3>");

    expect(blocks.map((b) => b.type)).toEqual(["title"]);
    expect(entries.map((e) => e.sourceTag)).toEqual(["h3"]);
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
    ]);
  });
});
