import type {
  TableBlock,
  TableRowData,
  TableCellData,
} from "@templatical/types";
import type { RenderContext } from "../render-context";
import {
  escapeAttr,
  escapeCssValue,
  escapeHtml,
  convertMergeTagsToValues,
} from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a table block to MJML markup.
 * Uses mj-text wrapping an HTML <table> with styled <tr>/<td> elements.
 */
export function renderTable(block: TableBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  if (block.rows.length === 0) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const visibilityAttr = getCssClassAttr(block);
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const fontSize = block.fontSize;
  // Emit the color only when set; otherwise the `mj-text` (and its cells,
  // which carry no color of their own) inherit the document `textColor`.
  const colorAttr = block.color ? `\n  color="${escapeAttr(block.color)}"` : "";
  const align = block.textAlign;

  const tableHtml = renderTableElement(block);

  return `<mj-text
  font-size="${fontSize}px"${colorAttr}
  align="${align}"
  line-height="1.5"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
>${tableHtml}</mj-text>`;
}

function renderTableElement(block: TableBlock): string {
  const borderColor = escapeCssValue(block.borderColor);
  const borderWidth = block.borderWidth;

  const tableStyle = "width: 100%; border-collapse: collapse;";

  let rowsHtml = "";

  for (let index = 0; index < block.rows.length; index++) {
    const row = block.rows[index];
    const isHeader = block.hasHeaderRow && index === 0;
    rowsHtml += renderRow(row, block, isHeader, borderColor, borderWidth);
  }

  return `<table style="${tableStyle}">${rowsHtml}</table>`;
}

function renderRow(
  row: TableRowData,
  block: TableBlock,
  isHeader: boolean,
  borderColor: string,
  borderWidth: number,
): string {
  let cellsHtml = "";

  for (const cell of row.cells) {
    cellsHtml += renderCell(cell, block, isHeader, borderColor, borderWidth);
  }

  return `<tr>${cellsHtml}</tr>`;
}

function renderCell(
  cell: TableCellData,
  block: TableBlock,
  isHeader: boolean,
  borderColor: string,
  borderWidth: number,
): string {
  const cellPadding = block.cellPadding;

  const styles: string[] = [
    `border: ${borderWidth}px solid ${borderColor}`,
    `padding: ${cellPadding}px`,
  ];

  if (isHeader) {
    styles.push("font-weight: bold");

    if (block.headerBackgroundColor) {
      styles.push(
        `background-color: ${escapeCssValue(block.headerBackgroundColor)}`,
      );
    }
  }

  const styleAttr = styles.join("; ");
  // Cells are a plain-text field (the editor stores innerText; TableCellData
  // carries no rich-text hint), so escape the content like menu/button. Merge
  // tags are resolved first: convertMergeTagsToValues matches a literal
  // `<span`, so escaping has to run after it — escaping first would turn the
  // span into `&lt;span` and the `{{value}}` placeholder would never resolve.
  const content = escapeHtml(convertMergeTagsToValues(cell.content));

  const tag = isHeader ? "th" : "td";

  return `<${tag} style="${styleAttr}">${content}</${tag}>`;
}

function renderFontFamilyAttr(
  fontFamily: string | undefined,
  context: RenderContext,
): string {
  if (!fontFamily) {
    return "";
  }

  const resolved = context.resolveFontFamily(fontFamily);

  return ` font-family="${resolved}"`;
}
