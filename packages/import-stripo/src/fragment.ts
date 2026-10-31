import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import { convertHtmlTemplate } from "@templatical/import-html";
import type { ImportReportEntry } from "@templatical/import-html";
import type { Block, SectionBlock } from "@templatical/types";
import {
  imageFromPaint,
  type ImageLayer,
  type ReadBackgroundImage,
} from "./css";

export interface ConvertCtx {
  entries: ImportReportEntry[];
  warnings: string[];
  /** Caller's plugin CSS. Applied inside each HTML fragment, never raw. */
  css?: string;
  /** `es-wrapper` colour, or `#ffffff` when the document has none. */
  pageBackground?: string;
  /**
   * The report entries of the sections that took each shared image, keyed by
   * the element that paints it (a body, stripe or structure cell).
   */
  imageSpans?: Map<object, ImportReportEntry[]>;
}

/** Paint after `createSectionBlock` so `styles` keeps its required padding. */
export function withBackground(
  section: SectionBlock,
  backgroundColor: string,
): SectionBlock {
  if (backgroundColor) section.styles.backgroundColor = backgroundColor;
  return section;
}

export function flattenBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type === "section") {
      for (const col of b.children ?? []) out.push(...flattenBlocks(col));
    } else {
      out.push(b);
    }
  }
  return out;
}

function fragmentDocument(inner: string, css?: string): string {
  const safe = css ? css.replace(/<\/style/gi, "<\\/style") : "";
  const head = safe ? `<head><style>${safe}</style></head>` : "";
  return `<!DOCTYPE html><html>${head}<body>${inner}</body></html>`;
}

/** The start of the HTML importer's page-image warning. */
const PAGE_IMAGE_WARNING = "The email background image ";
/** The start of the HTML importer's warning about an invalid `<html lang>`. */
const DEFAULT_LANGUAGE_WARNING = "Ignored the source's default language ";

/**
 * Run the generic HTML importer on a subtree and keep its blocks.
 * Section entries belong to the row the HTML importer invented; Stripo's own
 * section entries are recorded by the caller. A fragment's `<body>` is
 * synthetic, so the page-image warning the HTML importer raises for a `body`
 * background in the caller's CSS is dropped; Stripo reports the page image
 * once, from `es-wrapper`. A fragment's language is synthetic too (a nested
 * `<html lang>` merges into it), so Stripo reports the default language once,
 * from the page.
 */
export function blocksFromHtml(inner: string, ctx: ConvertCtx): Block[] {
  const result = convertHtmlTemplate(fragmentDocument(inner, ctx.css));
  for (const entry of result.report.entries) {
    if (entry.templaticalBlockType === "section") continue;
    ctx.entries.push(entry);
  }
  ctx.warnings.push(
    ...result.report.warnings.filter(
      (warning) =>
        !warning.startsWith(PAGE_IMAGE_WARNING) &&
        !warning.startsWith(DEFAULT_LANGUAGE_WARNING),
    ),
  );
  return flattenBlocks(result.content.blocks);
}

export function pushEntry(
  ctx: ConvertCtx,
  sourceTag: string,
  templaticalBlockType: string | null,
  status: ImportReportEntry["status"],
  note?: string,
): ImportReportEntry {
  const entry: ImportReportEntry = {
    sourceTag,
    templaticalBlockType,
    status,
    ...(note ? { note } : {}),
  };
  ctx.entries.push(entry);
  return entry;
}

/** Record that a section's entry took the image `source` paints. */
export function recordImageSpan(
  ctx: ConvertCtx,
  source: object | null,
  entry: ImportReportEntry,
): void {
  if (!source) return;
  ctx.imageSpans ??= new Map();
  const spanned = ctx.imageSpans.get(source) ?? [];
  spanned.push(entry);
  ctx.imageSpans.set(source, spanned);
}

/** Note on each entry whose section shares its image with another section. */
export function noteImageSpans(ctx: ConvertCtx): void {
  for (const spanned of ctx.imageSpans?.values() ?? []) {
    if (spanned.length < 2) continue;
    const note = `A background image behind ${spanned.length} sections was applied to each of them — Templatical has no multi-section band.`;
    for (const entry of spanned) {
      entry.status = "approximated";
      entry.note = entry.note ? `${entry.note} ${note}` : note;
    }
  }
}

/** The image an element paints: its inline CSS background, else its `background` attribute. */
export function imageOf(
  $el: Cheerio<Element>,
  label: string,
  boxWidth: number,
): ReadBackgroundImage | null {
  return imageFromPaint(
    $el.attr("style"),
    $el.attr("background"),
    label,
    boxWidth,
  );
}

/** An element's image with that element as its source; `null` when there is no element or it paints none. */
export function imageLayer(
  $el: Cheerio<Element> | null,
  label: string,
  boxWidth: number,
): ImageLayer | null {
  if (!$el) return null;
  const read = imageOf($el, label, boxWidth);
  return read ? { read, source: $el[0] } : null;
}

/**
 * The stripe's image: on the stripe, else on `$cell`, the cell Stripo paints
 * instead of a table stripe, as the band colour is read. A `td` / `th` stripe
 * is its own paint. The stripe names the image either way, since it is the
 * element that spans the sections.
 */
export function bandImage(
  $stripe: Cheerio<Element>,
  $cell: Cheerio<Element>,
  boxWidth: number,
): ImageLayer | null {
  const own = imageLayer($stripe, "Stripe", boxWidth);
  if (own) return own;
  if ($stripe.is("td") || $stripe.is("th")) return null;
  const cell = $cell.length > 0 ? imageOf($cell, "Stripe", boxWidth) : null;
  return cell ? { read: cell, source: $stripe[0] } : null;
}
