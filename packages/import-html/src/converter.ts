import { load } from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { resolveCssStyles } from "./css-resolver";
import { convertElement } from "./block-mapper";
import { processTable } from "./section-builder";
import {
  parseColor,
  parseFontFamily,
  parsePxValue,
  parseStyleAttribute,
} from "./style-parser";
import type { ImportReport, ImportReportEntry, ImportResult } from "./types";

function emptyMargin() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function emptyPadding() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function readPreheader($: CheerioAPI): string | undefined {
  // Convention: a hidden <div> at the very top with `display:none` containing
  // the preheader text. Match if it appears in the first ~3 children of body.
  const candidates = $("body")
    .children()
    .slice(0, 5)
    .filter((_, el) => {
      const styles = parseStyleAttribute($(el).attr("style"));
      return (styles.display ?? "").toLowerCase() === "none";
    });
  if (candidates.length === 0) return undefined;
  const text = $(candidates[0]).text().trim();
  return text || undefined;
}

function extractSettings($: CheerioAPI): TemplateContent["settings"] {
  const $body = $("body");
  const bodyStyles = parseStyleAttribute($body.attr("style"));
  const fontFamily = parseFontFamily(bodyStyles["font-family"]) || "Arial";
  const backgroundColor =
    parseColor(bodyStyles["background-color"]) ||
    parseColor(bodyStyles.background) ||
    "#ffffff";

  // Width heuristic: outermost table width attr, or ".container" width style.
  const $outerTable = $body.find("table").first();
  const widthAttr = parsePxValue($outerTable.attr("width"));
  const widthStyle = parsePxValue(
    parseStyleAttribute($outerTable.attr("style")).width,
  );
  const width = widthAttr || widthStyle || 600;

  const preheaderText = readPreheader($);

  return {
    width,
    backgroundColor,
    fontFamily,
    ...(preheaderText ? { preheaderText } : {}),
  };
}

/**
 * Wrap a list of free-floating blocks (those produced by top-level non-table
 * elements) in a single one-column section.
 */
function wrapInSection(blocks: Block[]): Block {
  return createSectionBlock({
    columns: "1",
    children: [blocks],
    styles: {
      padding: emptyPadding(),
      margin: emptyMargin(),
    },
  });
}

/**
 * Walk top-level body children. Tables become sections; loose content
 * elements are accumulated and wrapped in a single one-column section.
 */
function processBody(
  $: CheerioAPI,
  entries: ImportReportEntry[],
  warnings: string[],
): Block[] {
  const blocks: Block[] = [];
  const $body = $("body");
  const children = $body.children().toArray();

  let pendingLoose: Block[] = [];

  const flushLoose = () => {
    if (pendingLoose.length > 0) {
      blocks.push(wrapInSection(pendingLoose));
      pendingLoose = [];
    }
  };

  for (const childEl of children) {
    const tag = childEl.tagName?.toLowerCase() ?? "";
    const $child = $(childEl) as unknown as Cheerio<Element>;

    if (tag === "table") {
      flushLoose();
      blocks.push(...processTable($child, $, entries, warnings, false));
      continue;
    }

    // Skip hidden preheader divs — already captured in settings.
    const childStyles = parseStyleAttribute($child.attr("style"));
    if ((childStyles.display ?? "").toLowerCase() === "none") continue;

    // Containers like a wrapping <div> with table children: recurse.
    if (
      (tag === "div" || tag === "center" || tag === "main") &&
      $child.find("table").length > 0
    ) {
      flushLoose();
      $child.children().each((_, innerEl) => {
        const innerTag = innerEl.tagName?.toLowerCase() ?? "";
        const $inner = $(innerEl) as unknown as Cheerio<Element>;
        if (innerTag === "table") {
          blocks.push(...processTable($inner, $, entries, warnings, false));
        } else {
          const r = convertElement($inner, $);
          if (r) {
            entries.push(r.entry);
            pendingLoose.push(r.block);
          }
        }
      });
      flushLoose();
      continue;
    }

    const r = convertElement($child, $);
    if (r) {
      entries.push(r.entry);
      pendingLoose.push(r.block);
    }
  }

  flushLoose();
  return blocks;
}

/**
 * Converts an HTML email template to Templatical TemplateContent.
 *
 * Designed for table-based marketing email HTML (output of MJML, Mailchimp,
 * SendGrid, Campaign Monitor, hand-coded emails). Modern HTML using flex/grid
 * layouts is preserved via HTML-fallback blocks.
 *
 * @param html - The raw HTML string (full document or body fragment).
 * @returns An ImportResult with the converted content and a detailed report.
 *
 * @example
 * ```ts
 * import { convertHtmlTemplate } from '@templatical/import-html';
 *
 * const html = await fetch('/email.html').then((r) => r.text());
 * const { content, report } = convertHtmlTemplate(html);
 *
 * const editor = init({ container: '#editor', content });
 *
 * console.log(report.summary);
 * console.log(report.warnings);
 * ```
 */
export function convertHtmlTemplate(html: string): ImportResult {
  if (typeof html !== "string") {
    throw new Error(
      "Invalid HTML template: expected a string. Pass the raw HTML source as a string.",
    );
  }
  if (html.trim().length === 0) {
    throw new Error(
      "Invalid HTML template: input is empty. Pass the raw HTML source of an email.",
    );
  }

  const $ = load(html);
  resolveCssStyles($);

  // Drop tags that are never useful in the editor canvas.
  $("script, noscript, link, meta, title").remove();

  const entries: ImportReportEntry[] = [];
  const warnings: string[] = [];

  const blocks = processBody($, entries, warnings);

  if (blocks.length === 0) {
    warnings.push(
      "No convertible content was found in the HTML. The email may use a non-table layout — modern HTML support is limited.",
    );
  }

  const content: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks,
    settings: extractSettings($),
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
