import { load } from "cheerio";
import { createDefaultTemplateContent } from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { buildAttributeCascade } from "./attribute-resolver";
import { extractSettings } from "./head-parser";
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

  // The `xml` option routes parsing through htmlparser2 rather than parse5, so
  // custom `mj-*` tags survive as generic elements and no implicit
  // <html><head><body> is injected around them. Two htmlparser2 options are
  // then overridden away from what `xml: true` alone would give:
  //
  // - `xmlMode: false` puts htmlparser2 in HTML mode, which knows the void
  //   element list (`br`, `img`, `hr`, …) and closes them immediately. In XML
  //   mode a bare `<br>` stays open and everything after it — including the
  //   rest of the paragraph — becomes ITS CHILD rather than its sibling. That
  //   shape is exactly what TipTap emits for a hard break and what browser DOM
  //   serialization produces, so it hits `<mj-text>` content routinely; a
  //   later HTML-mode reparse (e.g. loading the block into the editor) then
  //   invents a *second* `<br>` from the dangling `</br>`, per the HTML5 rule
  //   that a stray `<br>` end tag opens a new `<br>` rather than closing one.
  // - `recognizeSelfClosing: true` restores what HTML mode otherwise gives up:
  //   without it, a self-closing custom tag like `<mj-image src="…" />` never
  //   actually closes, and swallows whatever follows as its child instead of
  //   its sibling — verified against a self-closing `<mj-all />` immediately
  //   followed by a sibling `<mj-text />` inside `<mj-attributes>`, which
  //   nested the second tag inside the first and silently dropped a per-tag
  //   attribute default.
  const $ = load(mjml, { xml: { xmlMode: false, recognizeSelfClosing: true } });
  const cascade = buildAttributeCascade($);

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];
  const blocks: Block[] = [];

  if (blocks.length === 0) {
    warnings.push(EMPTY_DOCUMENT_WARNING);
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: extractSettings($, cascade, warnings),
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
