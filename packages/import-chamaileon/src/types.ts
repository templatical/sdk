/**
 * Type definitions for the Chamaileon importer.
 *
 * The four report types are structurally identical to every other
 * `@templatical/import-*` package's, so a caller can treat all importers
 * uniformly. Changing a shape here without changing the others breaks that.
 *
 * The node type is loose on purpose. Email JSON 2.0.0 and 4.1.0 disagree on
 * key names; a strict 4.1 interface would reject every 2.0 document. Mappers
 * read through the helpers in `normalize.ts` / `attribute-parser.ts`.
 */

export type ConversionStatus =
  "converted" | "approximated" | "html-fallback" | "skipped";

export interface ImportReportEntry {
  /** The source Chamaileon `type` string (e.g. "fullwidth", "button", "typed-text"). */
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

/** Document-level design token (`variables[]` in 4.x). */
export interface ChamaileonVariable {
  name?: string;
  value?: unknown;
  type?: string;
  reference?: string;
  default?: unknown;
}

/**
 * One node of a Chamaileon document tree.
 *
 * `type` discriminates. `style` keys are kebab-case in 2.0 and camelCase in
 * 4.x; `attrs` holds content (`text`, `href`, `src`, `lineStyle`).
 */
export interface ChamaileonNode {
  eid?: string;
  type?: string;
  attrs?: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: ChamaileonNode[];
  placeholder?: ChamaileonNode[];
  customData?: unknown;
  version?: string;
  [key: string]: unknown;
}

/** The `getDocument()` object. */
export interface ChamaileonDocument {
  body?: ChamaileonNode;
  variables?: ChamaileonVariable[];
  components?: unknown[];
  title?: string;
  previewText?: string;
  subjectLine?: string;
  fontFiles?: Record<string, string>;
  [key: string]: unknown;
}
