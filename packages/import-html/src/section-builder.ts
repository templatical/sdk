import type { CheerioAPI, Cheerio } from "cheerio";
import { isTag } from "domhandler";
import type { Element } from "domhandler";
import {
  createSectionBlock,
  createButtonBlock,
  createSpacerBlock,
} from "@templatical/types";
import type { Block, ColumnLayout, SpacingValue } from "@templatical/types";
import {
  columnDivsOf,
  convertElement,
  convertHtmlFallback,
  isBlankCell,
  isButtonCell,
  isInlineContent,
  isSpacerCell,
  isTableContainer,
  walkContentNodes,
} from "./block-mapper";
import {
  LAYOUT_SHARES,
  readColumnWidth,
  resolveColumnRatio,
} from "./column-ratio";
import type { ColumnWidth } from "./column-ratio";
import {
  parseColor,
  parseLegacyColor,
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

/**
 * The padding an element insets its content by.
 *
 * A table cell falls back to its table's `cellpadding`, side by side: the
 * attribute pads every cell of the table, and a side the cell's own CSS
 * declares overrides it, as in a browser.
 */
function readHostPadding($el: Cheerio<Element>): SpacingValue {
  const styles = getStyles($el);
  const own = readPaddingFromStyles(styles);
  if (!$el.is("td, th")) return own;

  const cellpadding = parsePxValue($el.closest("table").attr("cellpadding"));
  if (!(cellpadding > 0)) return own;

  const declares = (side: keyof SpacingValue) =>
    styles.padding !== undefined || styles[`padding-${side}`] !== undefined;
  return {
    top: declares("top") ? own.top : cellpadding,
    right: declares("right") ? own.right : cellpadding,
    bottom: declares("bottom") ? own.bottom : cellpadding,
    left: declares("left") ? own.left : cellpadding,
  };
}

/**
 * The colour an element paints behind its content: its CSS background, then
 * its legacy `bgcolor` attribute, which CSS overrides.
 */
function fillOf($el: Cheerio<Element>): string {
  const styles = getStyles($el);
  return (
    parseColor(styles["background-color"]) ||
    parseColor(styles.background) ||
    parseLegacyColor($el.attr("bgcolor"))
  );
}

/**
 * Insets columns by the padding of the element that holds them, where that
 * padding places them: the top on each column's first block, the bottom on
 * each column's last, the left on the first column and the right on the
 * last. A single column takes all four sides.
 *
 * Blocks are the carrier because nothing else is: a column has no padding of
 * its own, and a cell's blocks flatten into whichever column the cell lands
 * in.
 */
function insetColumns(columns: Block[][], padding: SpacingValue): void {
  if (!padding.top && !padding.right && !padding.bottom && !padding.left)
    return;

  columns.forEach((column, columnIndex) => {
    const left = columnIndex === 0 ? padding.left : 0;
    const right = columnIndex === columns.length - 1 ? padding.right : 0;
    column.forEach((block, blockIndex) => {
      insetBlock(block, {
        top: blockIndex === 0 ? padding.top : 0,
        right,
        bottom: blockIndex === column.length - 1 ? padding.bottom : 0,
        left,
      });
    });
  });
}

/**
 * `room` less the side padding of something inside it, or `undefined` while
 * the room is unknown.
 */
function narrow(
  room: number | undefined,
  padding: SpacingValue,
): number | undefined {
  return room === undefined ? undefined : room - padding.left - padding.right;
}

/**
 * Adds `by` to a block's own padding.
 *
 * A spacer renders at its height and ignores its padding, in the canvas and
 * the export alike, so the top and bottom it is inset by are added to its
 * height instead. Held as padding, the space a spacer at a cell's edge
 * carries would vanish on export.
 */
function insetBlock(block: Block, by: SpacingValue): void {
  if (block.type === "spacer") {
    block.height += by.top + by.bottom;
    return;
  }
  const own = block.styles.padding;
  block.styles = {
    ...block.styles,
    padding: {
      top: own.top + by.top,
      right: own.right + by.right,
      bottom: own.bottom + by.bottom,
      left: own.left + by.left,
    },
  };
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
    // The cell's `bgcolor` is the button's colour, not the section's, which
    // is why a section's background skips a button cell.
    backgroundColor:
      parseColor(merged["background-color"]) ||
      parseColor(merged.background) ||
      parseLegacyColor($cell.attr("bgcolor")) ||
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
 * - The row's style must set no background and no padding. The section it
 *   emits is the carrier for those, so descending past a styled row would
 *   drop the band it paints.
 *
 * A fill the descent does pass — the row's `bgcolor`, its cell's, its
 * table's — is not lost: `processTable` hands it to the tables below, whose
 * sections take it when nothing nearer paints them. Section counts depend on
 * this gate, so a fill is carried down rather than made a reason to stop.
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
 * built: one slot per column means every column kept its own slot, while
 * fewer slots than columns means `resolveColumnLayout` merged them. Deciding
 * it by comparing the column count against the column ceiling instead would
 * be a second source of truth for that ceiling and would start lying the
 * moment the resolver changed. The ceiling appears only in the note's
 * wording, where it explains the merge to a reader rather than driving the
 * branch.
 *
 * A faithful row gets no `note` at all. Attaching one unconditionally makes
 * "nothing was lost" indistinguishable from a downgrade for a caller that
 * filters on `note`, which is the whole reason the field is optional.
 *
 * `columnCount` is the row's column hosts — layout cells, or the sibling
 * column `<div>`s a single cell holds — not every cell the row has: a
 * centring row's gutters were never columns, so counting them would report a
 * three-into-one merge for a row that always stated one column.
 *
 * A background the section could not keep adds its own note after the
 * layout's, so one entry names every loss the row had.
 */
function sectionEntry(
  columnCount: number,
  slotCount: number,
  ratioNote: string | undefined,
  fillNote: string | undefined,
): ImportReportEntry {
  const notes: string[] = [];
  if (slotCount !== columnCount) {
    notes.push(
      `Row of ${columnCount} columns was merged into a single column. Templatical sections hold at most 3 columns.`,
    );
  } else if (ratioNote) {
    notes.push(ratioNote);
  }
  if (fillNote) notes.push(fillNote);

  if (notes.length === 0) {
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
    note: notes.join(" "),
  };
}

/**
 * The background a row's section takes, with a note when a cell renders on
 * a colour the section does not keep.
 *
 * Nearest first: the `<tr>`, then its layout cells, then the tables around
 * it (`tableFill`, which a descended wrapper hands down). The cells count
 * when they share one fill, which covers the row's only cell as well as a
 * row painted alike across its columns. Cells that differ leave the section
 * to the table's fill, and the note names what each cell rendered on.
 *
 * A button cell is left out: its colour is the button's own, which
 * `buildCellButton` carries, and read as the section's it would band the
 * whole row in the button's colour.
 */
function sectionFill(
  $row: Cheerio<Element>,
  layoutCells: Cheerio<Element>[],
  tableFill: string,
  $: CheerioAPI,
): { color: string; note?: string } {
  const rowFill = fillOf($row);
  const cellFills = layoutCells
    .filter(($cell) => !isButtonCell($cell, $).match)
    .map(fillOf);
  const shared =
    cellFills.length > 0 && cellFills.every((fill) => fill === cellFills[0])
      ? cellFills[0]
      : "";
  const color = rowFill || shared || tableFill;

  // What each cell renders on: its own fill, or what shows through it.
  const rendered = cellFills.map((fill) => fill || rowFill || tableFill);
  if (rendered.every((fill) => fill === color)) return { color };

  const cells = rendered.map((fill) => fill || "none").join(" / ");
  const section = color
    ? `the section background ${color}`
    : "the section, which has no background";
  return {
    color,
    note: `Cell backgrounds ${cells} differ from ${section}. A Templatical section has one background colour.`,
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
 * The count is the row's column hosts, for the same reason `sectionEntry`'s
 * is: a centring row flattened into a parent column lost nothing, so it must
 * report nothing.
 */
function flattenedRowEntry(columnCount: number): ImportReportEntry | null {
  if (columnCount <= 1) return null;
  return {
    sourceTag: "tr",
    templaticalBlockType: null,
    status: "approximated",
    note: `Nested row of ${columnCount} columns lost its columns. A Templatical section cannot nest inside a column, so its columns were merged into the surrounding column.`,
  };
}

/**
 * One column's content host, and which kind of element it is.
 *
 * Normally a row's columns are its `<td>`s. The exception is a single cell
 * holding one inline-block `<div>` per column, which `columnDivsOf` reads —
 * so a host is either a cell or one of those column containers, and the two
 * are extracted differently.
 */
interface ColumnHost {
  $el: Cheerio<Element>;
  kind: "cell" | "container";
}

/**
 * The elements that each carry one of the row's columns.
 *
 * A cell holding a column set is replaced by that set, so the count comes from
 * the divs rather than from the one cell around them. Only a single layout
 * cell is considered: columns inside a column are not representable, so a
 * multi-cell row keeps its cells and can never have its count *reduced* by
 * this rule.
 *
 * Asked after `centringCells`, which is what lets a gutter-flanked row whose
 * middle cell holds a column set still be read as that set.
 */
function columnHostsOf(
  layoutCells: Cheerio<Element>[],
  $: CheerioAPI,
): ColumnHost[] {
  if (layoutCells.length === 1) {
    const containers = columnDivsOf(layoutCells[0], $);
    if (containers)
      return containers.map(($el) => ({ $el, kind: "container" as const }));
  }
  return layoutCells.map(($el) => ({ $el, kind: "cell" as const }));
}

/**
 * The blocks a column host contributes.
 *
 * A promoted container takes the content walk rather than the cell walk,
 * which is the same walk a container reached from inside a cell already gets
 * — so promoting one changes which slot its blocks land in and nothing about
 * how they convert. The two early returns the cell walk adds are about cells
 * specifically — `isSpacerCell` reads a `<td height>`, and `isButtonCell`
 * reads the cell-level styling table-based email wraps a call to action in —
 * and `looksLikeButton` answers true for `display: inline-block`, which every
 * column container carries. Handing a container to the cell walk would turn a
 * column whose content is one link into a single button block and drop
 * everything the column's own table holds.
 */
function extractHostBlocks(
  host: ColumnHost,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
  room: number | undefined,
): Block[] {
  return host.kind === "cell"
    ? extractCellBlocks(host.$el, $, entries, warnings, room)
    : extractContentBlocks(host.$el, $, entries, warnings, room);
}

/** The width an element declares, from the strongest signal it carries. */
function readDeclaredWidth($el: Cheerio<Element>): ColumnWidth | null {
  return readColumnWidth($el.attr("class"), getStyles($el), $el.attr("width"));
}

function extractCellBlocks(
  $cell: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
  room: number | undefined,
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
  return extractContentBlocks($cell, $, entries, warnings, room);
}

/**
 * The blocks an element's child nodes produce, for an element that holds
 * content rather than being content itself: a table cell, or a layout
 * container descended from one.
 *
 * Node classification — bare text and inline markup grouped into runs, a
 * prose anchor folded into the run around it, comments passed over without
 * splitting one — is `walkContentNodes`' half, shared with the body walk in
 * `converter.ts`. What is left here is the half that differs: inside a cell a
 * nested table flattens into the surrounding column, where at body level it
 * becomes a section of its own.
 *
 * `room` is the width a line has across the host's column, before the host's
 * own padding narrows it for everything inside.
 */
function extractContentBlocks(
  $host: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
  room: number | undefined,
): Block[] {
  const blocks: Block[] = [];
  const padding = readHostPadding($host);
  const inner = narrow(room, padding);

  walkContentNodes(
    $host,
    $,
    ({ block, entry }) => {
      entries.push(entry);
      blocks.push(block);
    },
    ($child, tag) => {
      if (tag === "table") {
        blocks.push(
          ...processTable($child, $, entries, warnings, true, "", inner),
        );
        return;
      }

      // A container contributes no block of its own; the content below it
      // takes its place. `div` is a text tag in the block mapper, so handing a
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
        blocks.push(
          ...extractContentBlocks($child, $, entries, warnings, inner),
        );
        return;
      }

      const r = convertElement($child, $, inner);
      if (r) {
        entries.push(r.entry);
        blocks.push(r.block);
      }
    },
  );

  // The host's padding insets everything it holds, bare text and blocks
  // alike. Nested hosts have inset their own blocks already, so the padding
  // of every cell and container around a block adds up.
  insetColumns([blocks], padding);
  return blocks;
}

/**
 * The room each of a row's hosts has, from the room across the row.
 *
 * `layout` is the one the hosts land in, `"1"` when they stack, and each
 * host takes its column's share of the row. A column set's cell pads the
 * row's edges, so its left side narrows the first column and its right the
 * last; stacked, every host sits between both.
 */
function hostRooms(
  rowRoom: number | undefined,
  layout: ColumnLayout,
  hostCount: number,
  setPadding: SpacingValue | undefined,
): (number | undefined)[] {
  const shares = LAYOUT_SHARES[layout];
  const edges = setPadding ?? emptyPadding();
  return Array.from({ length: hostCount }, (_, index) => {
    if (rowRoom === undefined) return undefined;
    if (layout === "1") return rowRoom - edges.left - edges.right;
    const share = (rowRoom * shares[index]) / 100;
    const left = index === 0 ? edges.left : 0;
    const right = index === hostCount - 1 ? edges.right : 0;
    return share - left - right;
  });
}

/**
 * Walk a `<table>` and produce Section blocks (one per row).
 *
 * @param flattenInline - When true (used for nested tables), drop the section
 *   wrapper and return the flat block list. Templatical sections cannot nest,
 *   so nested layout-tables are merged into their parent cell.
 * @param enclosingFill - The fill of the wrapper rows, cells and tables this
 *   table was reached through, which its sections take when nothing nearer
 *   paints them.
 * @param room - The width, in px, a line can span where the table's blocks
 *   land: the template body's width for a table whose rows become sections,
 *   the surrounding column's for a flattened one. Unknown, a divider keeps a
 *   px width as stated.
 */
export function processTable(
  $table: Cheerio<Element>,
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
  flattenInline = false,
  enclosingFill = "",
  room?: number,
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

  const tableFill = fillOf($table) || enclosingFill;
  const sections: Block[] = [];

  for (const $row of rows) {
    const cells = getDirectCells($row, $);
    if (cells.length === 0) continue;

    // A wrapper row contributes no section of its own; its tables take its
    // place. Bounded by DOM depth: each step descends to a table strictly
    // inside this row. `flattenInline` is carried through unchanged, because
    // Templatical forbids a section inside a column — a wrapper reached from
    // a parent cell must keep flattening.
    //
    // The wrapper's fill goes down with the descent, so the sections below
    // take it when nothing nearer paints them.
    const packaging = packagingRowTables($row, cells, $);
    if (packaging) {
      const carried = fillOf($row) || fillOf(cells[0]) || tableFill;
      // Flattened, the descended blocks land in the parent column, so the
      // wrapper cell's padding insets them as it would have had the walk
      // stopped at the cell, and narrows their room with it.
      const wrapperPadding = readHostPadding(cells[0]);
      const innerRoom = flattenInline ? narrow(room, wrapperPadding) : room;
      const descended: Block[] = [];
      for (const $inner of packaging) {
        descended.push(
          ...processTable(
            $inner,
            $,
            entries,
            warnings,
            flattenInline,
            carried,
            innerRoom,
          ),
        );
      }
      if (flattenInline) insetColumns([descended], wrapperPadding);
      sections.push(...descended);
      continue;
    }

    // A row's gutters are not columns, so the cells that state the layout are
    // what the hosts are drawn from, and the hosts are what everything below
    // reads — the column count, the blocks, the declared widths and both
    // report entries. Reading `cells.length` for the report instead would
    // claim a three-into-one merge for a row that always had one column.
    const layoutCells = centringCells(cells) ?? cells;
    const hosts = columnHostsOf(layoutCells, $);
    const countedLayout = resolveColumnLayout(hosts.length, warnings);

    // The count is settled; the declared widths only choose which layout of
    // that count. `"1"` is skipped because a single column holds the whole
    // row by definition, so there is no ratio to choose and none to report —
    // and because that is also the layout a merged row lands on, whose own
    // note is the loss worth naming. A flattened row has no section to lay
    // out.
    const ratio =
      countedLayout === "1" || flattenInline
        ? { layout: countedLayout, note: undefined }
        : resolveColumnRatio(
            hosts.map((host) => readDeclaredWidth(host.$el)),
            countedLayout,
          );

    const padding = readPaddingFromStyles(getStyles($row));
    // A column set's cell pads the row around its columns, and none of the
    // hosts is that cell, so this row applies its padding: to the hosts'
    // room here and to their blocks below. Merged or flattened, the columns
    // stack into one.
    const setPadding =
      hosts[0]?.kind === "container"
        ? readHostPadding(layoutCells[0])
        : undefined;
    const stacked = countedLayout === "1" || flattenInline;
    const rooms = hostRooms(
      flattenInline ? room : narrow(room, padding),
      stacked ? "1" : ratio.layout,
      hosts.length,
      setPadding,
    );

    let columnsBlocks: Block[][];
    if (countedLayout === "1") {
      const merged: Block[] = [];
      hosts.forEach((host, index) => {
        merged.push(
          ...extractHostBlocks(host, $, entries, warnings, rooms[index]),
        );
      });
      columnsBlocks = [merged];
    } else {
      columnsBlocks = hosts.map((host, index) =>
        extractHostBlocks(host, $, entries, warnings, rooms[index]),
      );
    }

    if (setPadding) {
      insetColumns(
        flattenInline ? [columnsBlocks.flat()] : columnsBlocks,
        setPadding,
      );
    }

    if (flattenInline) {
      const dropped = flattenedRowEntry(hosts.length);
      if (dropped) entries.push(dropped);
      for (const col of columnsBlocks) sections.push(...col);
      continue;
    }

    const fill = sectionFill($row, layoutCells, tableFill, $);

    entries.push(
      sectionEntry(hosts.length, columnsBlocks.length, ratio.note, fill.note),
    );
    sections.push(
      createSectionBlock({
        columns: ratio.layout,
        children: columnsBlocks,
        styles: {
          padding,
          ...(fill.color ? { backgroundColor: fill.color } : {}),
        },
      }),
    );
  }

  return sections;
}
