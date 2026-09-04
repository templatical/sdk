import { load } from "cheerio";
import { createDefaultTemplateContent } from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import type { ImportReport, ImportReportEntry, ImportResult } from "./types";

const EMPTY_DOCUMENT_WARNING =
  "No convertible content was found in the MJML. Check that the document has an <mj-body> with at least one <mj-section>.";

/**
 * Convert an MJML document into a Templatical template.
 *
 * @example
 * ```ts
 * const { content, report } = convertMjmlTemplate(mjmlSource);
 *
 * const editor = init({ container: '#editor', content });
 *
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertMjmlTemplate(mjml: string): ImportResult {
  if (typeof mjml !== "string") {
    throw new Error(
      "Invalid MJML template: expected a string. Pass the raw MJML source as a string.",
    );
  }
  if (mjml.trim().length === 0) {
    throw new Error(
      "Invalid MJML template: input is empty. Pass the raw MJML source of an email.",
    );
  }

  // XML mode routes through htmlparser2 rather than parse5: custom `mj-*` tags
  // survive as generic elements and no implicit <html><head><body> is injected
  // around them. Switching to HTML mode relocates every MJML tag.
  load(mjml, { xml: true });

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  if (blocks.length === 0) {
    warnings.push(EMPTY_DOCUMENT_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
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
