/**
 * Type definitions for the Topol.io importer.
 *
 * `ConversionStatus`, `ImportReport`, and `ImportResult` are structurally
 * identical to the same types in `import-html`, `import-mjml`,
 * `import-beefree`, and `import-unlayer`, so a caller can treat those three
 * types uniformly across every `@templatical/import-*` package.
 * `ImportReportEntry` is not: its first field is `sourceTag` here, the same
 * name `import-html` and `import-mjml` use, but `import-beefree` calls it
 * `beeFreeModuleType` and `import-unlayer` calls it `unlayerContentType` — the
 * one field a caller reading across every importer would have to branch on.
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
