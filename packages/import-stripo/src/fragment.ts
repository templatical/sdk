import { convertHtmlTemplate } from "@templatical/import-html";
import type { ImportReportEntry } from "@templatical/import-html";
import type { Block } from "@templatical/types";

export interface ConvertCtx {
  entries: ImportReportEntry[];
  warnings: string[];
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

/** Run the generic HTML importer on a subtree and keep its blocks, not its sections. */
export function blocksFromHtml(inner: string, ctx: ConvertCtx): Block[] {
  const wrapped = `<!DOCTYPE html><html><body>${inner}</body></html>`;
  const result = convertHtmlTemplate(wrapped);
  ctx.entries.push(...result.report.entries);
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
