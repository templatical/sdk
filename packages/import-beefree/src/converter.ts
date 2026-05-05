import {
  createSectionBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { Block, ColumnLayout, TemplateContent } from "@templatical/types";
import type {
  BeeFreeTemplate,
  BeeFreeeRow,
  BeeFreeeColumn,
  ImportResult,
  ImportReport,
  ImportReportEntry,
} from "./types";
import { convertModule } from "./block-mapper";
import { parsePxValue, parseColor, parseFontFamily } from "./style-parser";

/**
 * Determines the Templatical ColumnLayout from BeeFree column grid values.
 */
function resolveColumnLayout(
  columns: BeeFreeeColumn[],
  warnings: string[],
): ColumnLayout | null {
  if (columns.length === 1) return null; // Single column — no section wrapper needed
  if (columns.length === 3) return "3";

  if (columns.length === 2) {
    const left = columns[0]["grid-columns"] ?? 6;
    const right = columns[1]["grid-columns"] ?? 6;
    const total = left + right;
    const ratio = left / total;

    if (ratio > 0.58) return "2-1";
    if (ratio < 0.42) return "1-2";
    return "2";
  }

  if (columns.length >= 4) {
    warnings.push(
      `Row with ${columns.length} columns was flattened to a single column. BeeFree supports arbitrary columns, but Templatical supports up to 3.`,
    );
    return null; // Flatten to single column
  }

  return "2";
}

/**
 * Converts all modules in a column to Templatical blocks.
 */
function convertColumnModules(
  column: BeeFreeeColumn,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];

  for (const module of column.modules) {
    const { block, entry } = convertModule(module, warnings);
    blocks.push(block);
    entries.push(entry);
  }

  return blocks;
}

/**
 * Processes a single BeeFree row into one or more Templatical blocks.
 */
function processRow(
  row: BeeFreeeRow,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const columns = row.columns;
  if (!columns || columns.length === 0) return [];

  // Track locked/synced metadata
  if (row.locked) {
    warnings.push(
      "A locked row was imported. Lock metadata was dropped; content is preserved.",
    );
  }
  if (row.synced) {
    warnings.push(
      "A synced row was imported. Sync metadata was dropped; content is preserved.",
    );
  }

  const layout = resolveColumnLayout(columns, warnings);

  if (!layout) {
    // Single column (or flattened 4+ columns) — return modules directly
    const blocks: Block[] = [];
    for (const column of columns) {
      blocks.push(...convertColumnModules(column, entries, warnings));
    }
    return blocks;
  }

  // Multi-column — wrap in a SectionBlock
  const children: Block[][] = columns.map((col) =>
    convertColumnModules(col, entries, warnings),
  );

  // Extract section-level background from row content styles
  const rowBg = parseColor(row.content?.style?.["background-color"]);

  const section = createSectionBlock({
    columns: layout,
    children,
    styles: {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      ...(rowBg ? { backgroundColor: rowBg } : {}),
    },
  });

  return [section];
}

/**
 * Extracts template-level settings from the BeeFree body.
 */
function extractSettings(
  template: BeeFreeTemplate,
): TemplateContent["settings"] {
  const body = template.page.body;
  const contentStyle = body?.content?.style ?? {};
  const containerStyle = body?.container?.style ?? {};

  const width = parsePxValue(contentStyle["width"] ?? contentStyle.width);
  const bgColor =
    parseColor(contentStyle["background-color"]) ||
    parseColor(containerStyle["background-color"]) ||
    "#ffffff";
  const fontFamily = parseFontFamily(contentStyle["font-family"]) || "Arial";

  return {
    width: width || 600,
    backgroundColor: bgColor,
    fontFamily,
    locale: "en",
  };
}

/**
 * Converts a BeeFree template JSON to Templatical TemplateContent.
 *
 * @param template - The parsed BeeFree JSON object
 * @returns An ImportResult with the converted content and a detailed report
 *
 * @example
 * ```ts
 * import { convertBeeFreeTemplate } from '@templatical/import-beefree';
 *
 * const beeFreeJson = JSON.parse(fileContent);
 * const { content, report } = convertBeeFreeTemplate(beeFreeJson);
 *
 * // Use the content with the editor
 * const editor = init({ container: '#editor', content });
 *
 * // Check the report for any issues
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertBeeFreeTemplate(
  template: BeeFreeTemplate,
): ImportResult {
  // Validate structure
  if (!template?.page?.rows) {
    throw new Error(
      "Invalid BeeFree template: missing page.rows. Ensure you are passing a valid BeeFree JSON export.",
    );
  }

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  // Extract web font warnings
  const webFonts = template.page.body?.webFonts;
  if (webFonts && webFonts.length > 1) {
    warnings.push(
      `Template uses ${webFonts.length} web fonts. Only the primary font is preserved; additional fonts may need to be configured via the fonts option.`,
    );
  }

  // Process rows
  for (const row of template.page.rows) {
    if (row.empty) continue;
    blocks.push(...processRow(row, entries, warnings));
  }

  // Build template content
  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: extractSettings(template),
  };

  // Build report summary
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
