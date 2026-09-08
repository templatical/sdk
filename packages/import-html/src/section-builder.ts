import type { CheerioAPI, Cheerio } from "cheerio";
import { isTag } from "domhandler";
import type { AnyNode, Element } from "domhandler";
import {
  createSectionBlock,
  createButtonBlock,
  createSpacerBlock,
} from "@templatical/types";
import type { Block, ColumnLayout } from "@templatical/types";
import {
  convertElement,
  convertHtmlFallback,
  convertInlineRun,
  isBlankCell,
  isButtonCell,
  isInlineContent,
  isProseAnchor,
  isSpacerCell,
  isTableContainer,
  looksLikeButton,
} from "./block-mapper";
import {
  parseColor,
  parsePxValue,
  parseStyleAttribute,
  readPaddingFromStyles,
} from "./style-parser";
import type { ImportReportEntry } from "./types";

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

/**
 * The one cell a row's content sits in, when every other cell of that row is
 * chrome rather than a column — or `null` when the row is a layout row in its
 * own right.
 *
 * Table-based email centres a fixed-width body by flanking it with blank
 * cells, and Foundation-derived markup pads a row out with a blank `expander`
 * cell. Counting cells reads both as columns: leemunroe's template, the
 * most-copied table email there is, imported as a three-column section with
 * the entire email crushed into the middle third and two empty columns beside
 * it. That is worse than the single column a cell count could never have
 * produced, so it is the one place a row's cell count is not the column count.
 *
 * The signal is content, never width: a cell is chrome when it holds nothing
 * a reader sees (`isBlankCell`), which covers a `&nbsp;` gutter and an empty
 * `expander` alike, and covers a blank cell stating a height — a horizontal
 * gutter's height says nothing about the row.
 *
 * Two constraints, both hazards a relaxed version would reintroduce:
 *
 * - Exactly one cell may carry content. Two filled cells and a blank third
 *   is a grid with an empty slot, and collapsing it would re-flow the filled
 *   columns from thirds to halves.
 * - A row with content in no cell at all is left alone. Its cells sit side by
 *   side, so it states one gap per column rather than a stack of them, and
 *   merging them would add their heights and invent vertical space.
 *
 * This rule is coupled to the container descent in `packagingTablesOf`, and
 * neither is complete without the other: the descent reaches Foundation's
 * layout rows, whose blank `expander` cell then reads as a second column
 * holding nothing but a spacer. Removing this rule turns every one of those
 * rows into a phantom two-column section.
 */
function centringCells(cells: Cheerio<Element>[]): Cheerio<Element>[] | null {
  if (cells.length < 2) return null;
  const withContent = cells.filter(($cell) => !isBlankCell($cell));
  return withContent.length === 1 ? withContent : null;
}

/**
 * Whether the markup below a layout container states columns anywhere: a row
 * with two or more cells carrying content.
 *
 * This gates the container descent below, and only there — the two content
 * walks descend a container unconditionally, which is right for them because
 * they convert its children in place. The packaging descent *promotes* the
 * rows it reaches to sections of their own, so it needs evidence that those
 * rows are layout rather than stacked content.
 *
 * Without the evidence test the descent shatters a section into one section
 * per block, wherever a single cell holds one container per column instead of
 * one cell per column. Measured on compiled MJML — a `div.mj-column-per-*`
 * per column inside one `<td>` — a five-section email imported as thirteen
 * one-block sections, and Cerberus's hybrid template went from 14 sections to
 * 24. Neither loses text; both lose the grouping the source stated, and a
 * cell holding parallel containers has no column count below it to recover in
 * exchange.
 *
 * Content-bearing cells, not cells: a blank-flanked row is one column, which
 * is what `centringCells` reads it as. Counting bare cells here would make
 * this the second answer in the file to "is this row a set of columns?".
 */
function declaresColumnsBelow($el: Cheerio<Element>, $: CheerioAPI): boolean {
  let found = false;
  $el.find("tr").each((_, row) => {
    if (found) return;
    const cells = getDirectCells($(row) as unknown as Cheerio<Element>, $);
    if (cells.filter(($cell) => !isBlankCell($cell)).length > 1) found = true;
  });
  return found;
}

/**
 * The tables that make up a cell's entire meaningful content, or `null` when
 * the cell holds anything else.
 *
 * Anything that is not a table has to leave nothing behind for the cell to
 * count as packaging: whitespace, comments, and inline formatting carrying no
 * text all produce no block, so a cell holding tables and a bare `<br>`
 * qualifies while one holding a heading beside its table does not.
 *
 * A layout container is descended rather than refused, through the same
 * `isTableContainer` predicate the two content walks use — plus the evidence
 * test above, which is what keeps the descent from shattering a section whose
 * columns are sibling containers in one cell. Refusing a container outright
 * made a `<div>` or a `<center>` between the cell and the layout table enough
 * to defeat the descent, and the cell walk then flattened the whole subtree
 * into one column: ZURB Inky's output, which wraps every email in a
 * `<center>`, imported as a single one-column section.
 *
 * The recursion is what keeps the guard below intact through the wrapper: a
 * container holding prose beside its table answers `null`, which propagates,
 * and the row keeps the section that carries that prose.
 *
 * Bounded by DOM depth — a container is descended only when it holds a table,
 * and each step moves to a child.
 */
function packagingTablesOf(
  $cell: Cheerio<Element>,
  $: CheerioAPI,
): Cheerio<Element>[] | null {
  const tables: Cheerio<Element>[] = [];
  let inlineText = "";

  for (const node of $cell.contents().toArray()) {
    if (isInlineContent(node)) {
      inlineText += $(node).text();
      continue;
    }
    // Comments and processing instructions carry no content.
    if (!isTag(node)) continue;

    const tag = node.tagName.toLowerCase();
    const $child = $(node) as unknown as Cheerio<Element>;
    if (tag === "table") {
      tables.push($child);
      continue;
    }
    if (isTableContainer($child, tag) && declaresColumnsBelow($child, $)) {
      const nested = packagingTablesOf($child, $);
      if (nested === null) return null;
      tables.push(...nested);
      continue;
    }
    return null;
  }

  if (tables.length === 0) return null;
  if (inlineText.trim() !== "") return null;
  return tables;
}

/**
 * The tables a row is merely packaging for, or `null` when the row is layout
 * in its own right.
 *
 * Table-based email buries the row that states the real column count under
 * one-cell wrapper tables, and a section emitted for a wrapper resolves
 * `columns` from that single cell — reporting one column for a row that has
 * two or three. Descending to the table inside reads the count off the row
 * that actually declares it, which is counting cells rather than inferring a
 * layout from widths or class names.
 *
 * Two conditions keep the descent from losing anything, and both are hazards
 * a future edit would reintroduce by relaxing them:
 *
 * - The cell's meaningful content must *be* the tables. Descending discards
 *   the row, so a heading or an image beside the table would be dropped.
 * - The row must carry no background and no padding. The section it emits is
 *   the only carrier for those, so descending past a styled row would drop
 *   the band it paints.
 */
function packagingRowTables(
  $row: Cheerio<Element>,
  cells: Cheerio<Element>[],
  $: CheerioAPI,
): Cheerio<Element>[] | null {
  if (cells.length !== 1) return null;

  const rowStyles = getStyles($row);
  if (
    parseColor(rowStyles["background-color"]) ||
    parseColor(rowStyles.background)
  )
    return null;
  const padding = readPaddingFromStyles(rowStyles);
  if (padding.top || padding.right || padding.bottom || padding.left)
    return null;

  return packagingTablesOf(cells[0], $);
}

/**
 * The report entry for the section a layout row produces.
 *
 * Whether the row was downgraded is read off the slots that were actually
 * built: one slot per cell means every cell kept its own column, while fewer
 * slots than cells means `resolveColumnLayout` merged them. Deciding it by
 * comparing the cell count against the column ceiling instead would be a
 * second source of truth for that ceiling and would start lying the moment
 * the resolver changed. The ceiling appears only in the note's wording, where
 * it explains the merge to a reader rather than driving the branch.
 *
 * A faithful row gets no `note` at all. Attaching one unconditionally makes
 * "nothing was lost" indistinguishable from a downgrade for a caller that
 * filters on `note`, which is the whole reason the field is optional.
 *
 * `cellCount` is the row's column-bearing cells, not every cell it has: a
 * centring row's gutters were never columns, so counting them would report a
 * three-into-one merge for a row that always stated one column.
 */
function sectionEntry(cellCount: number, slotCount: number): ImportReportEntry {
  if (slotCount === cellCount) {
    return {
      sourceTag: "tr",
      templaticalBlockType: "section",
      status: "converted",
    };
  }
  return {
    sourceTag: "tr",
    templaticalBlockType: "section",
    status: "approximated",
    note: `Row of ${cellCount} cells was merged into a single column. Templatical sections hold at most 3 columns.`,
  };
}

/**
 * The report entry for a nested row whose section wrapper was dropped, or
 * `null` when dropping it lost nothing.
 *
 * `packages/core/src/editor.ts` forbids a section inside a column because MJML
 * forbids `mj-section` there, so a layout table reached from a cell has to
 * flatten — the columns are gone regardless. One cell has no columns to lose,
 * and reporting that as a downgrade would fill the report with entries for a
 * non-event.
 *
 * The count is the row's column-bearing cells, for the same reason
 * `sectionEntry`'s is: a centring row flattened into a parent column lost
 * nothing, so it must report nothing.
 */
function flattenedRowEntry(cellCount: number): ImportReportEntry | null {
  if (cellCount <= 1) return null;
  return {
    sourceTag: "tr",
    templaticalBlockType: null,
    status: "approximated",
    note: `Nested row of ${cellCount} cells lost its columns. A Templatical section cannot nest inside a column, so its cells were merged into the surrounding column.`,
  };
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

  // A cell whose only content is text has no element children, and the walk
  // below is what reads it: the text node becomes an inline run and then one
  // rich-text block styled from the cell. Handing the `<td>` to
  // `convertElement` instead matches no mapping there and comes back as an
  // html block, so an early return for this case intercepts the good path.
  return extractContentBlocks($cell, $, entries, warnings);
}

/**
 * The blocks an element's child nodes produce, for an element that holds
 * content rather than being content itself: a table cell, or a layout
 * container descended from one.
 *
 * Walked as child *nodes*, not child elements. A bare text node between two
 * elements is content, and a walk over `children()` never visits it — so
 * `Hello<br>World` loses both words while emitting a block holding nothing
 * but `<br>`. Consecutive inline nodes therefore accumulate into one run and
 * become a single paragraph, which is what makes a bare line agree with the
 * same line wrapped in a `<p>`.
 *
 * `$host` is what an inline run reads its styling and source tag from: a bare
 * run has no element of its own, and the nearest enclosing element is the one
 * carrying the colour, size and alignment it renders with.
 */
function extractContentBlocks(
  $host: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];
  let inlineRun: AnyNode[] = [];

  const flushInlineRun = () => {
    if (inlineRun.length === 0) return;
    const run = inlineRun;
    inlineRun = [];
    const r = convertInlineRun(run, $host, $);
    if (r) {
      entries.push(r.entry);
      blocks.push(r.block);
    }
  };

  for (const node of $host.contents().toArray()) {
    if (isInlineContent(node)) {
      inlineRun.push(node);
      continue;
    }
    // Comments and processing instructions carry no content, and must not end
    // the run either: a merge-tag comment sitting mid-sentence would otherwise
    // split one line into two paragraphs.
    if (!isTag(node)) continue;

    const $child = $(node) as unknown as Cheerio<Element>;
    const tag = node.tagName.toLowerCase();

    // A link inside a sentence is part of that sentence, so it joins the run
    // rather than ending it: one rich-text block carries the whole line, with
    // the anchor's own markup inside it.
    //
    // Asked before the run is flushed and before the button branch below,
    // which is what keeps a call to action out of a sentence — a styled
    // anchor is not a prose anchor, so it falls through to the branch that
    // builds its button.
    if (tag === "a" && isProseAnchor($child)) {
      inlineRun.push(node);
      continue;
    }

    flushInlineRun();

    if (tag === "table") {
      const inner = processTable($child, $, entries, warnings, true);
      blocks.push(...inner);
      continue;
    }

    // A container contributes no block of its own; the content below it takes
    // its place. `div` is a text tag in the block mapper, so handing a
    // container to `convertElement` emits one paragraph whose content is the
    // entire table subtree as raw markup — the table's blocks never exist.
    //
    // Recursing here rather than passing a flag is what keeps the descent
    // consistent with the cell's own walk: a table found below a container
    // reaches the `table` branch above and flattens, which it must, because
    // Templatical forbids a section inside a column however many wrappers
    // deep the table sits. Bounded by DOM depth — a container is descended
    // only when it holds a table, and each step moves to a child.
    if (isTableContainer($child, tag)) {
      blocks.push(...extractContentBlocks($child, $, entries, warnings));
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

  flushInlineRun();

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

    // A wrapper row contributes no section of its own; its tables take its
    // place. Bounded by DOM depth: each step descends to a table strictly
    // inside this row. `flattenInline` is carried through unchanged, because
    // Templatical forbids a section inside a column — a wrapper reached from
    // a parent cell must keep flattening.
    const packaging = packagingRowTables($row, cells, $);
    if (packaging) {
      for (const $inner of packaging) {
        sections.push(
          ...processTable($inner, $, entries, warnings, flattenInline),
        );
      }
      continue;
    }

    // A row's gutters are not columns, so the cells that state the layout are
    // what everything below reads — the column count, the blocks, and both
    // report entries. Reading `cells.length` for the report instead would
    // claim a three-into-one merge for a row that always had one column.
    const layoutCells = centringCells(cells) ?? cells;
    const layout = resolveColumnLayout(layoutCells.length, warnings);

    let columnsBlocks: Block[][];
    if (layout === "1") {
      const merged: Block[] = [];
      for (const $cell of layoutCells) {
        merged.push(...extractCellBlocks($cell, $, entries, warnings));
      }
      columnsBlocks = [merged];
    } else {
      columnsBlocks = layoutCells.map(($cell) =>
        extractCellBlocks($cell, $, entries, warnings),
      );
    }

    if (flattenInline) {
      const dropped = flattenedRowEntry(layoutCells.length);
      if (dropped) entries.push(dropped);
      for (const col of columnsBlocks) sections.push(...col);
      continue;
    }

    const rowStyles = getStyles($row);
    const bgColor =
      parseColor(rowStyles["background-color"]) ||
      parseColor(rowStyles.background);
    const padding = readPaddingFromStyles(rowStyles);

    entries.push(sectionEntry(layoutCells.length, columnsBlocks.length));
    sections.push(
      createSectionBlock({
        columns: layout,
        children: columnsBlocks,
        styles: {
          padding,
          ...(bgColor ? { backgroundColor: bgColor } : {}),
        },
      }),
    );
  }

  return sections;
}
