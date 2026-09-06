/**
 * Type definitions for the Topol.io importer.
 *
 * The four report types are structurally identical to every other
 * `@templatical/import-*` package's, so a caller can treat all importers
 * uniformly. Changing a shape here without changing the others breaks that.
 */

export type ConversionStatus =
  "converted" | "approximated" | "html-fallback" | "skipped";

export interface ImportReportEntry {
  /** The source Topol tag name (e.g. "mj-text", "mj-social", "mj-gif"). */
  sourceTag: string;
  /** The Templatical block type produced, or null if skipped. */
  templaticalBlockType: string | null;
  status: ConversionStatus;
  note?: string;
}

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

export interface ImportResult {
  content: import("@templatical/types").TemplateContent;
  report: ImportReport;
}

/** A Topol attribute value. Topol writes explicit `null` for "unset". */
export type TopolAttrValue = string | number | boolean | null | undefined;

/**
 * One node of a Topol design tree.
 *
 * `content` sits at the top level rather than inside `attributes`, and carries
 * rich-text HTML for `mj-text` and a button label for `mj-button`.
 */
export interface TopolNode {
  tagName: string;
  attributes?: Record<string, TopolAttrValue | Record<string, TopolAttrValue>>;
  children?: TopolNode[];
  content?: string;
  uid?: string;
  [key: string]: unknown;
}

/** The design root — the node whose `tagName` is `mj-global-style`. */
export interface TopolDesign extends TopolNode {
  tagName: string;
  fonts?: unknown;
  style?: unknown;
}
