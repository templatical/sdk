import type { BeeFreeTemplate } from "@templatical/import-beefree";
import type { UnlayerTemplate } from "@templatical/import-unlayer";
import type { TemplateContent } from "@templatical/types";
import type { ImportKind } from "../scenes/import/shared";

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

function parseStripo(raw: string): { html: string; css?: string } {
  if (raw.trimStart().startsWith("{")) {
    const obj = parseJson(raw) as { html?: unknown; css?: unknown };
    if (typeof obj.html === "string") {
      return {
        html: obj.html,
        css: typeof obj.css === "string" ? obj.css : undefined,
      };
    }
  }
  return { html: raw };
}

/** The fields shared by every converter's report entries. */
export interface ImportReportEntry {
  sourceTag?: string;
  unlayerContentType?: string;
  beeFreeModuleType?: string;
  templaticalBlockType: string | null;
  status: "converted" | "approximated" | "html-fallback" | "skipped";
  note?: string;
}

export interface ImportResult {
  content: TemplateContent;
  report: {
    entries: ImportReportEntry[];
    summary: {
      total: number;
      converted: number;
      approximated: number;
      htmlFallback: number;
      skipped: number;
    };
    warnings: string[];
  };
}

export async function convertImportSourceWithReport(
  kind: ImportKind,
  raw: string,
): Promise<ImportResult> {
  switch (kind) {
    case "unlayer": {
      const { convertUnlayerTemplate } =
        await import("@templatical/import-unlayer");
      return convertUnlayerTemplate(parseJson(raw) as UnlayerTemplate);
    }
    case "beefree": {
      const { convertBeeFreeTemplate } =
        await import("@templatical/import-beefree");
      return convertBeeFreeTemplate(parseJson(raw) as BeeFreeTemplate);
    }
    case "html": {
      const { convertHtmlTemplate } = await import("@templatical/import-html");
      return convertHtmlTemplate(raw);
    }
    case "mjml": {
      const { convertMjmlTemplate } = await import("@templatical/import-mjml");
      return convertMjmlTemplate(raw);
    }
    case "topol": {
      const { convertTopolTemplate } =
        await import("@templatical/import-topol");
      return convertTopolTemplate(raw);
    }
    case "stripo": {
      const { convertStripoTemplate } =
        await import("@templatical/import-stripo");
      const { html, css } = parseStripo(raw);
      return convertStripoTemplate(html, css ? { css } : undefined);
    }
    case "chamaileon": {
      const { convertChamaileonTemplate } =
        await import("@templatical/import-chamaileon");
      return convertChamaileonTemplate(raw);
    }
    case "easy-email-pro": {
      const { convertEasyEmailProTemplate } =
        await import("@templatical/import-easy-email-pro");
      return convertEasyEmailProTemplate(raw);
    }
  }
}

export async function convertImportSource(
  kind: ImportKind,
  raw: string,
): Promise<TemplateContent> {
  return (await convertImportSourceWithReport(kind, raw)).content;
}
