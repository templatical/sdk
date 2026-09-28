import {
  createSectionBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { Block, ColumnLayout, TemplateContent } from "@templatical/types";
import type {
  UnlayerTemplate,
  UnlayerRow,
  UnlayerColumn,
  ImportResult,
  ImportReport,
  ImportReportEntry,
} from "./types";
import {
  convertContent,
  DEFAULT_BODY_WIDTH,
  FALLBACK_TEXT_COLOR,
} from "./block-mapper";
import type { ContentContext } from "./block-mapper";
import {
  parsePxValue,
  parseColor,
  parseFontFamily,
  parsePaddingShorthand,
} from "./style-parser";

function resolveColumnLayout(
  cells: number[],
  warnings: string[],
): ColumnLayout {
  if (cells.length <= 1) return "1";
  if (cells.length === 3) return "3";

  if (cells.length === 2) {
    const left = cells[0] ?? 1;
    const right = cells[1] ?? 1;
    const total = left + right;
    const ratio = left / total;

    if (ratio > 0.58) return "2-1";
    if (ratio < 0.42) return "1-2";
    return "2";
  }

  warnings.push(
    `Row with ${cells.length} columns was flattened to a single column. Unlayer supports arbitrary columns, but Templatical supports up to 3.`,
  );
  return "1";
}

/** Each column's share of the body width, by layout. */
const COLUMN_SHARES: Record<ColumnLayout, number[]> = {
  "1": [1],
  "2": [1 / 2, 1 / 2],
  "3": [1 / 3, 1 / 3, 1 / 3],
  "1-2": [1 / 3, 2 / 3],
  "2-1": [2 / 3, 1 / 3],
};

/**
 * A column's px width as the renderer draws it: the body width times the
 * column's share, rounded down. A column past the layout's last slot takes
 * the whole body width, the renderer's fallback.
 */
function columnWidthAt(
  layout: ColumnLayout,
  bodyWidth: number,
  index: number,
): number {
  return Math.floor(bodyWidth * (COLUMN_SHARES[layout][index] ?? 1));
}

/**
 * Converts all contents in a column to Templatical blocks.
 */
function convertColumnContents(
  column: UnlayerColumn,
  context: ContentContext,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];

  for (const content of column.contents ?? []) {
    const { block, entry } = convertContent(content, warnings, context);
    blocks.push(block);
    entries.push(entry);
  }

  return blocks;
}

/**
 * The section's fill. `columnsBackgroundColor` covers the content width, the
 * area a section paints; `backgroundColor` is the band outside it, used only
 * when the row sets no content colour.
 */
function resolveRowBackground(
  row: UnlayerRow,
  warnings: string[],
): string | undefined {
  const content = parseColor(row.values?.columnsBackgroundColor);
  const band = parseColor(row.values?.backgroundColor);
  if (content && band && content !== band) {
    warnings.push(
      `Row background ${band} outside the content width was dropped; the section keeps the content background ${content}.`,
    );
  }
  return content || band || undefined;
}

/**
 * Processes a single Unlayer row into one or more Templatical blocks.
 *
 * Each column's px width derives from `settings.width` and the resolved
 * layout; every block also learns the template's `textColor`.
 */
function processRow(
  row: UnlayerRow,
  settings: TemplateContent["settings"],
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const columns = row.columns;
  if (!columns || columns.length === 0) return [];

  const cells = row.cells ?? columns.map(() => 1);
  const layout = resolveColumnLayout(cells, warnings);
  const contextAt = (index: number): ContentContext => ({
    columnWidth: columnWidthAt(layout, settings.width, index),
    textColor: settings.textColor,
  });

  let children: Block[][];
  if (layout === "1") {
    const merged: Block[] = [];
    for (const column of columns) {
      merged.push(
        ...convertColumnContents(column, contextAt(0), entries, warnings),
      );
    }
    children = [merged];
  } else {
    children = columns.map((col, index) =>
      convertColumnContents(col, contextAt(index), entries, warnings),
    );
  }

  const background = resolveRowBackground(row, warnings);
  const padding = parsePaddingShorthand(row.values?.padding);

  const section = createSectionBlock({
    columns: layout,
    children,
    styles: {
      padding,
      ...(background ? { backgroundColor: background } : {}),
    },
  });

  return [section];
}

/**
 * Extracts template-level settings from the Unlayer body values.
 */
function extractSettings(
  template: UnlayerTemplate,
): TemplateContent["settings"] {
  const values = template.body?.values ?? {};

  const width = parsePxValue(values.contentWidth);
  const bgColor = parseColor(values.backgroundColor) || "#ffffff";
  const fontFamily = parseFontFamily(values.fontFamily) || "Arial";
  const textColor = parseColor(values.textColor) || FALLBACK_TEXT_COLOR;
  const linkColor = parseColor(values.linkStyle?.linkColor);
  // An unstated underline is on: Unlayer's default, the browser's and the SDK's.
  const underline = values.linkStyle?.linkUnderline;
  const linkUnderline = typeof underline === "boolean" ? underline : true;
  const preheaderText =
    typeof values.preheaderText === "string" ? values.preheaderText.trim() : "";

  return {
    width: width > 0 ? width : DEFAULT_BODY_WIDTH,
    backgroundColor: bgColor,
    textColor,
    linkUnderline,
    fontFamily,
    locale: "en",
    ...(linkColor ? { linkColor } : {}),
    ...(preheaderText ? { preheaderText } : {}),
  };
}

/**
 * Converts an Unlayer design JSON to Templatical TemplateContent.
 *
 * @param template - The parsed Unlayer JSON object (the result of `editor.saveDesign(...)`)
 * @returns An ImportResult with the converted content and a detailed report
 *
 * @example
 * ```ts
 * import { convertUnlayerTemplate } from '@templatical/import-unlayer';
 *
 * const unlayerJson = JSON.parse(fileContent);
 * const { content, report } = convertUnlayerTemplate(unlayerJson);
 *
 * const editor = init({ container: '#editor', content });
 *
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertUnlayerTemplate(
  template: UnlayerTemplate,
): ImportResult {
  if (!template?.body?.rows) {
    throw new Error(
      "Invalid Unlayer template: missing body.rows. Ensure you are passing a valid Unlayer JSON design (the output of editor.saveDesign).",
    );
  }

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  const headers = template.body.headers ?? [];
  const footers = template.body.footers ?? [];
  const settings = extractSettings(template);

  if (headers.length > 0) {
    warnings.push(
      `${headers.length} Unlayer header row(s) were imported as regular rows at the top of the template.`,
    );
    for (const row of headers) {
      blocks.push(...processRow(row, settings, entries, warnings));
    }
  }

  for (const row of template.body.rows) {
    blocks.push(...processRow(row, settings, entries, warnings));
  }

  if (footers.length > 0) {
    warnings.push(
      `${footers.length} Unlayer footer row(s) were imported as regular rows at the bottom of the template.`,
    );
    for (const row of footers) {
      blocks.push(...processRow(row, settings, entries, warnings));
    }
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings,
  };

  const summary = {
    total: entries.length,
    converted: entries.filter((e) => e.status === "converted").length,
    approximated: entries.filter((e) => e.status === "approximated").length,
    htmlFallback: entries.filter((e) => e.status === "html-fallback").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
  };

  const report: ImportReport = { entries, warnings, summary };

  return { content, report };
}
