/**
 * Type definitions for the MJML email importer.
 *
 * These four types are structurally identical to the ones every other
 * `@templatical/import-*` package exports, so a caller can treat all importers
 * uniformly. Changing a shape here without changing the others breaks that.
 */

/**
 * Conversion status for each MJML element processed in the import report.
 */
export type ConversionStatus =
  "converted" | "approximated" | "html-fallback" | "skipped";

/**
 * A single entry in the import report.
 */
export interface ImportReportEntry {
  /** The source MJML tag name (e.g. "mj-section", "mj-image", "mj-hero"). */
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
 * The result of an MJML import operation.
 */
export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
}
