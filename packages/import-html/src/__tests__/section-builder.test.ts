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
