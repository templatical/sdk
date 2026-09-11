import { load } from "cheerio";
import { convertHtmlTemplate } from "@templatical/import-html";
import type { ImportReport, ImportResult } from "@templatical/import-html";
import { createDefaultTemplateContent } from "@templatical/types";
import { convertCompiled } from "./compiled";
import { detectStripoKind } from "./detect";
import { convertEditor } from "./editor";
import type { ConvertCtx } from "./fragment";

export interface ConvertStripoOptions {
  /** Sibling CSS from plugin `getTemplateData()`. Ignored on compiled exports. */
  css?: string;
}

function injectCss(html: string, css?: string): string {
  if (!css || css.trim().length === 0) return html;
  const $ = load(html);
  if ($("head").length === 0) {
    $("html").prepend("<head></head>");
  }
  // Style elements serialize as HTML rawtext, so a literal `</style` in the
  // CSS would close the element and the rest would parse as markup — which
  // can flip editor/compiled detection. Neutralize the closer; then set a
  // text node rather than interpolating into an HTML string.
  const safe = css.replace(/<\/style/gi, "<\\/style");
  const $style = $("<style></style>").attr("data-stripo-css", "1").text(safe);
  $("head").append($style);
  return $.html() ?? html;
}

function summarize(ctx: ConvertCtx): ImportReport {
  const summary = {
    total: ctx.entries.length,
    converted: 0,
    approximated: 0,
    htmlFallback: 0,
    skipped: 0,
  };
  for (const e of ctx.entries) {
    if (e.status === "converted") summary.converted++;
    else if (e.status === "approximated") summary.approximated++;
    else if (e.status === "html-fallback") summary.htmlFallback++;
    else if (e.status === "skipped") summary.skipped++;
  }
  return { entries: ctx.entries, warnings: ctx.warnings, summary };
}

/**
 * Convert a Stripo template to Templatical content.
 *
 * Auto-detects the surface from class attributes:
 * - `esd-*` on elements → plugin/editor `getTemplateData` HTML
 * - `es-wrapper` / `es-*-body` without `esd-*` → compiled File→HTML export
 *
 * Pass `options.css` when converting plugin storage (`getTemplateData().css`).
 */
export function convertStripoTemplate(
  html: string,
  options?: ConvertStripoOptions,
): ImportResult {
  if (typeof html !== "string") {
    throw new Error(
      "Invalid Stripo template: expected a string. Pass the HTML source as a string.",
    );
  }
  if (html.trim().length === 0) {
    throw new Error(
      "Invalid Stripo template: input is empty. Pass the HTML source of a Stripo email.",
    );
  }

  const prepared = injectCss(html, options?.css);
  const kind = detectStripoKind(prepared);
  const fallback = convertHtmlTemplate(prepared);

  if (!kind) {
    return {
      content: fallback.content,
      report: {
        ...fallback.report,
        warnings: [
          "No Stripo class attributes found; converted as generic HTML.",
          ...fallback.report.warnings,
        ],
      },
    };
  }

  const ctx: ConvertCtx = { entries: [], warnings: [] };
  const blocks =
    kind === "editor"
      ? convertEditor(prepared, ctx)
      : convertCompiled(prepared, ctx);

  return {
    content: {
      ...createDefaultTemplateContent(),
      ...fallback.content,
      blocks,
    },
    report: summarize(ctx),
  };
}
