import { convertHtmlTemplate } from "@templatical/import-html";
import type { ImportReportEntry } from "@templatical/import-html";
import type { Block, SectionBlock } from "@templatical/types";

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

/**
 * Run the generic HTML importer on a subtree and keep its blocks.
 * Section entries belong to the row the HTML importer invented; Stripo's own
 * section entries are recorded by the caller.
 */
export function blocksFromHtml(inner: string, ctx: ConvertCtx): Block[] {
  const result = convertHtmlTemplate(fragmentDocument(inner, ctx.css));
  for (const entry of result.report.entries) {
    if (entry.templaticalBlockType === "section") continue;
    ctx.entries.push(entry);
  }
  ctx.warnings.push(...result.report.warnings);
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
