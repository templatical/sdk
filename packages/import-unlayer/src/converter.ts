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
import { convertContent } from "./block-mapper";
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

/**
 * Converts all contents in a column to Templatical blocks.
 */
function convertColumnContents(
  column: UnlayerColumn,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];

  for (const content of column.contents ?? []) {
    const { block, entry } = convertContent(content, warnings);
    blocks.push(block);
    entries.push(entry);
  }

  return blocks;
}

/**
 * Processes a single Unlayer row into one or more Templatical blocks.
 */
function processRow(
  row: UnlayerRow,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const columns = row.columns;
  if (!columns || columns.length === 0) return [];

  const cells = row.cells ?? columns.map(() => 1);
  const layout = resolveColumnLayout(cells, warnings);

  let children: Block[][];
  if (layout === "1") {
    const merged: Block[] = [];
    for (const column of columns) {
      merged.push(...convertColumnContents(column, entries, warnings));
    }
    children = [merged];
  } else {
    children = columns.map((col) =>
      convertColumnContents(col, entries, warnings),
    );
  }

  const rowBg = parseColor(row.values?.backgroundColor);
  const padding = parsePaddingShorthand(row.values?.padding);

  const section = createSectionBlock({
    columns: layout,
    children,
    styles: {
      padding,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      ...(rowBg ? { backgroundColor: rowBg } : {}),
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

  return {
    width: width || 600,
    backgroundColor: bgColor,
    fontFamily,
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

  if (headers.length > 0) {
    warnings.push(
      `${headers.length} Unlayer header row(s) were imported as regular rows at the top of the template.`,
    );
    for (const row of headers) {
      blocks.push(...processRow(row, entries, warnings));
    }
  }

  for (const row of template.body.rows) {
    blocks.push(...processRow(row, entries, warnings));
  }

  if (footers.length > 0) {
    warnings.push(
      `${footers.length} Unlayer footer row(s) were imported as regular rows at the bottom of the template.`,
    );
    for (const row of footers) {
      blocks.push(...processRow(row, entries, warnings));
    }
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: extractSettings(template),
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
