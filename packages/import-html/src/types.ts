/**
 * Type definitions for the HTML email importer.
 */

/**
 * Conversion status for each element processed in the import report.
 */
export type ConversionStatus =
  | "converted"
  | "approximated"
  | "html-fallback"
  | "skipped";

/**
 * A single entry in the import report.
 */
export interface ImportReportEntry {
  /** The source HTML element tag name (e.g. "h1", "img", "table"). */
  sourceTag: string;
  /** The Templatical block type produced, or null if skipped. */
  templaticalBlockType: string | null;
  status: ConversionStatus;
  note?: string;
}

/**
 * The full import report returned alongside the converted template.
 */
export interface ImportReport {
  entries: ImportReportEntry[];
  warnings: string[];
  summary: {
    total: number;
    converted: number;
    approximated: number;
    htmlFallback: number;
    skipped: number;
  };
}

/**
 * The result of an HTML import operation.
 */
export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
}
