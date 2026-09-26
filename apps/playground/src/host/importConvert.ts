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

export async function convertImportSource(
  kind: ImportKind,
  raw: string,
): Promise<TemplateContent> {
  switch (kind) {
    case "unlayer": {
      const { convertUnlayerTemplate } =
        await import("@templatical/import-unlayer");
      return convertUnlayerTemplate(parseJson(raw) as UnlayerTemplate).content;
    }
    case "beefree": {
      const { convertBeeFreeTemplate } =
        await import("@templatical/import-beefree");
      return convertBeeFreeTemplate(parseJson(raw) as BeeFreeTemplate).content;
    }
    case "html": {
      const { convertHtmlTemplate } = await import("@templatical/import-html");
      return convertHtmlTemplate(raw).content;
    }
    case "mjml": {
      const { convertMjmlTemplate } = await import("@templatical/import-mjml");
      return convertMjmlTemplate(raw).content;
    }
    case "topol": {
      const { convertTopolTemplate } =
        await import("@templatical/import-topol");
      return convertTopolTemplate(raw).content;
    }
    case "stripo": {
      const { convertStripoTemplate } =
        await import("@templatical/import-stripo");
      const { html, css } = parseStripo(raw);
      return convertStripoTemplate(html, css ? { css } : undefined).content;
    }
    case "chamaileon": {
      const { convertChamaileonTemplate } =
        await import("@templatical/import-chamaileon");
      return convertChamaileonTemplate(raw).content;
    }
    case "easy-email-pro": {
      const { convertEasyEmailProTemplate } =
        await import("@templatical/import-easy-email-pro");
      return convertEasyEmailProTemplate(raw).content;
    }
  }
}
