import { load, type CheerioAPI } from "cheerio";
import { convertHtmlTemplate } from "@templatical/import-html";
import type { ImportReport, ImportResult } from "@templatical/import-html";
import { createDefaultTemplateContent, isLocaleTag } from "@templatical/types";
import { convertCompiled } from "./compiled";
import { colorFromPaint, imageFromPaint } from "./css";
import { detectStripoKind } from "./detect";
import { convertEditor } from "./editor";
import { noteImageSpans, type ConvertCtx } from "./fragment";

export interface ConvertStripoOptions {
  /** Used when the source declares no default language. */
  defaultLocale?: string;
  /** Sibling CSS from plugin `getTemplateData()`. Applied inside each HTML fragment. */
  css?: string;
}

/**
 * The default language, as `convertHtmlTemplate` reads it: `<html lang>`, else
 * `defaultLocale`, else `"en"`. A value that isn't a language tag after `_` →
 * `-` is skipped, with a warning naming it. The fallback converter warns on its
 * own report, so the Stripo path repeats the check for its report.
 */
function defaultLanguage(
  declared: string | undefined,
  defaultLocale: string | undefined,
  warnings: string[],
): string {
  const rejected: string[] = [];
  let locale = "en";
  for (const [value, name] of [
    [declared, "the source's default language"],
    [defaultLocale, "defaultLocale"],
  ] as const) {
    if (!value) continue;
    const tag = value.replaceAll("_", "-");
    if (isLocaleTag(tag)) {
      locale = tag;
      break;
    }
    rejected.push(`Ignored ${name} "${value}": unsupported language tag.`);
  }
  for (const message of rejected) warnings.push(`${message} Used "${locale}".`);
  return locale;
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

/** First painted `es-wrapper-color` / `es-wrapper`, or white when neither is set. */
function pageBackground($: CheerioAPI): string {
  const nodes = $(
    "[class~='es-wrapper-color'], [class~='es-wrapper']",
  ).toArray();
  for (const node of nodes) {
    const $el = $(node);
    const color = colorFromPaint($el.attr("style"), $el.attr("bgcolor"));
    if (color) return color;
  }
  return "#ffffff";
}

/** The page's background image, which has no Templatical equivalent: the first `es-wrapper-color` / `es-wrapper` that paints one. */
function pageImageWarning($: CheerioAPI): string | null {
  const nodes = $(
    "[class~='es-wrapper-color'], [class~='es-wrapper']",
  ).toArray();
  for (const node of nodes) {
    const $el = $(node);
    const read = imageFromPaint(
      $el.attr("style"),
      $el.attr("background"),
      "Page",
      undefined,
    );
    if (read) {
      return `The email background image "${read.image.url}" was dropped; Templatical has no email-level background image.`;
    }
  }
  return null;
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
  const fallback = convertHtmlTemplate(prepared, {
    defaultLocale: options?.defaultLocale,
  });

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

  const ctx: ConvertCtx = {
    entries: [],
    warnings: [],
    css: options?.css,
  };
  const $page = load(prepared);
  const locale = defaultLanguage(
    $page("html").attr("lang")?.trim(),
    options?.defaultLocale,
    ctx.warnings,
  );
  const pageBg = pageBackground($page);
  const pageImage = pageImageWarning($page);
  if (pageImage) ctx.warnings.push(pageImage);
  ctx.pageBackground = pageBg;
  const blocks =
    kind === "editor"
      ? convertEditor(prepared, ctx)
      : convertCompiled(prepared, ctx);
  noteImageSpans(ctx);

  // After `fallback.content`: its settings carry the HTML importer's white
  // page, which would hide the wrapper colour.
  const defaults = createDefaultTemplateContent();
  return {
    content: {
      ...defaults,
      ...fallback.content,
      blocks,
      settings: {
        ...defaults.settings,
        ...fallback.content.settings,
        locale,
        backgroundColor: pageBg,
      },
    },
    report: summarize(ctx),
  };
}
