import type { CustomFont, ExportResult, FontsConfig } from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

export interface UseExportOptions {
  authManager: AuthManager;
  getFontsConfig?: () => FontsConfig | undefined;
  canUseCustomFonts?: () => boolean;
}

export interface UseExportReturn {
  exportHtml: (templateId: string) => Promise<ExportResult>;
  getMjmlSource: (templateId: string) => Promise<string>;
}

export function useExport(options: UseExportOptions): UseExportReturn {
  const { authManager, getFontsConfig, canUseCustomFonts } = options;
  const api = new ApiClient(authManager);

  function getExportFontsPayload(): {
    customFonts: CustomFont[];
    defaultFallback: string;
  } {
    const fontsConfig = getFontsConfig?.();
    const customFontsAllowed = canUseCustomFonts?.() ?? true;

    return {
      customFonts:
        customFontsAllowed && fontsConfig?.customFonts
          ? fontsConfig.customFonts
          : [],
      defaultFallback: fontsConfig?.defaultFallback ?? "Arial, sans-serif",
    };
  }

  async function exportHtml(templateId: string): Promise<ExportResult> {
    const fontsPayload = getExportFontsPayload();
    const result = await api.exportTemplate(templateId, fontsPayload);

    return {
      html: result.html,
      mjml: result.mjml,
    };
  }

  async function getMjmlSource(templateId: string): Promise<string> {
    const fontsPayload = getExportFontsPayload();
    const result = await api.exportTemplate(templateId, fontsPayload);
    return result.mjml;
  }

  return {
    exportHtml,
    getMjmlSource,
  };
}
