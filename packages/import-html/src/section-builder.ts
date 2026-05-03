import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createSectionBlock,
  createButtonBlock,
  createSpacerBlock,
} from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import {
  convertElement,
  convertHtmlFallback,
  isButtonCell,
  isSpacerCell,
  looksLikeButton,
} from "./block-mapper";
import {
  parseColor,
  parsePxValue,
  parseStyleAttribute,
  readPaddingFromStyles,
} from "./style-parser";
import type { ImportReportEntry } from "./types";

function emptyMargin() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function emptyPadding() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function getStyles($el: Cheerio<Element>): Record<string, string> {
  return parseStyleAttribute($el.attr("style"));
}

function buildCellButton(
  $cell: Cheerio<Element>,
  $anchor: Cheerio<Element>,
): Block {
  const cellStyles = getStyles($cell);
  const aStyles = getStyles($anchor);
  // Anchor styles win when they overlap (typical: anchor sets text color, cell sets bg).
  const merged = { ...cellStyles, ...aStyles };
  const text = ($anchor.text() ?? "Button").trim() || "Button";
  const url = $anchor.attr("href") ?? "#";
  const target = $anchor.attr("target");

  return createButtonBlock({
    text,
    url,
    openInNewTab: target === "_blank" || undefined,
    backgroundColor:
      parseColor(merged["background-color"]) ||
      parseColor(merged.background) ||
      "#4f46e5",
    textColor: parseColor(merged.color) || "#ffffff",
    borderRadius: parsePxValue(merged["border-radius"]),
    fontSize: parsePxValue(merged["font-size"]) || 16,
    buttonPadding: readPaddingFromStyles(merged),
    styles: {
      padding: emptyPadding(),
      margin: emptyMargin(),
    },
  });
}

function buildSpacerFromCell($cell: Cheerio<Element>): Block {
  const cellStyles = getStyles($cell);
  const height =
    parsePxValue($cell.attr("height")) ||
    parsePxValue(cellStyles.height) ||
    parsePxValue(cellStyles["line-height"]) ||
    24;
  return createSpacerBlock({
    height,
    styles: {
      padding: emptyPadding(),
      margin: emptyMargin(),
    },
  });
}

/**
 * Returns the direct child `<tr>` rows of a table, including those one level
 * inside `<thead>`, `<tbody>`, or `<tfoot>` (which the HTML parser inserts
 * automatically).
 */
function getDirectRows(
  $table: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] {
  const rows: Cheerio<Element>[] = [];
  $table.children("tr").each((_, el) => {
    rows.push($(el) as unknown as Cheerio<Element>);
  });
  $table.children("thead, tbody, tfoot").each((_, group) => {
    $(group)
      .children("tr")
      .each((_i, el) => {
        rows.push($(el) as unknown as Cheerio<Element>);
      });
  });
  return rows;
}

function getDirectCells(
  $row: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] {
  const cells: Cheerio<Element>[] = [];
  $row.children("td, th").each((_, el) => {
    cells.push($(el) as unknown as Cheerio<Element>);
  });
  return cells;
}

function isLayoutTable($table: Cheerio<Element>, $: CheerioAPI): boolean {
  // A table is "layout" if any descendant carries content email blocks rely on,
  // OR if any cell contains a non-text element (custom tags, semantic blocks,
  // etc. — those should be preserved as html-fallback at the element level
  // rather than collapsing the entire table into one html block).
  // A bare data table (cells contain only text) is preserved as HTML.
  if (
    $table.find(
      "img, a, h1, h2, h3, h4, h5, h6, table, hr, p, div, span, ul, ol, li, blockquote, video, iframe",
    ).length > 0
  )
    return true;

  let hasNonStandardChild = false;
  $table.find("td, th").each((_, td) => {
    if (hasNonStandardChild) return;
    if ($(td).children().length > 0) hasNonStandardChild = true;
  });
  return hasNonStandardChild;
}

function resolveColumnLayout(
  cellCount: number,
  warnings: string[],
): ColumnLayout {
  if (cellCount <= 1) return "1";
  if (cellCount === 2) return "2";
  if (cellCount === 3) return "3";
  warnings.push(
    `Row with ${cellCount} columns was flattened to a single column. Templatical supports up to 3 columns per section.`,
  );
  return "1";
}

function extractCellBlocks(
  $cell: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  if (isSpacerCell($cell)) {
    entries.push({
      sourceTag: "td",
      templaticalBlockType: "spacer",
      status: "converted",
    });
    return [buildSpacerFromCell($cell)];
  }

  const btn = isButtonCell($cell, $);
  if (btn.match && btn.anchor) {
    entries.push({
      sourceTag: "td",
      templaticalBlockType: "button",
      status: "converted",
    });
    return [buildCellButton($cell, btn.anchor)];
  }

  const blocks: Block[] = [];
  const childEls = $cell.children().toArray();

  if (childEls.length === 0) {
    const text = ($cell.text() ?? "").trim();
    if (!text) return [];
    const r = convertElement($cell, $);
    if (r) {
      entries.push(r.entry);
      blocks.push(r.block);
    }
    return blocks;
  }

  for (const childEl of childEls) {
    const $child = $(childEl) as unknown as Cheerio<Element>;
    const tag = childEl.tagName?.toLowerCase() ?? "";

    if (tag === "table") {
      const inner = processTable($child, $, entries, warnings, true);
      blocks.push(...inner);
      continue;
    }

    if (tag === "a" && looksLikeButton(getStyles($child))) {
      const r = convertElement($child, $);
      if (r) {
        entries.push(r.entry);
        blocks.push(r.block);
      }
      continue;
    }

    const r = convertElement($child, $);
    if (r) {
      entries.push(r.entry);
      blocks.push(r.block);
    }
  }

  return blocks;
}

/**
 * Walk a `<table>` and produce Section blocks (one per row).
 *
 * @param flattenInline - When true (used for nested tables), drop the section
 *   wrapper and return the flat block list. Templatical sections cannot nest,
 *   so nested layout-tables are merged into their parent cell.
 */
export function processTable(
  $table: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
  flattenInline = false,
): Block[] {
  if (!isLayoutTable($table, $)) {
    entries.push({
      sourceTag: "table",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "Data table preserved as HTML block.",
    });
    return [convertHtmlFallback($table, $, "Data table preserved as HTML")];
  }

  const rows = getDirectRows($table, $);
  if (rows.length === 0) return [];

  const sections: Block[] = [];

  for (const $row of rows) {
    const cells = getDirectCells($row, $);
    if (cells.length === 0) continue;

    const layout = resolveColumnLayout(cells.length, warnings);

    let columnsBlocks: Block[][];
    if (layout === "1") {
      const merged: Block[] = [];
      for (const $cell of cells) {
        merged.push(...extractCellBlocks($cell, $, entries, warnings));
      }
      columnsBlocks = [merged];
    } else {
      columnsBlocks = cells.map(($cell) =>
        extractCellBlocks($cell, $, entries, warnings),
      );
    }

    if (flattenInline) {
      for (const col of columnsBlocks) sections.push(...col);
      continue;
    }

    const rowStyles = getStyles($row);
    const bgColor =
      parseColor(rowStyles["background-color"]) ||
      parseColor(rowStyles.background);
    const padding = readPaddingFromStyles(rowStyles);

    sections.push(
      createSectionBlock({
        columns: layout,
        children: columnsBlocks,
        styles: {
          padding,
          margin: emptyMargin(),
          ...(bgColor ? { backgroundColor: bgColor } : {}),
        },
      }),
    );
  }

  return sections;
}
