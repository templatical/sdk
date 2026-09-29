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
): void {
  ctx.entries.push({
    sourceTag,
    templaticalBlockType,
    status,
    ...(note ? { note } : {}),
  });
}
