import type { CustomFont, ExportResult, FontsConfig } from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

/** The fonts half of an export request, as Cloud's endpoint expects it. */
export interface ExportFontsPayload {
  customFonts: CustomFont[];
  defaultFallback: string;
}

export interface UseExportOptions {
  authManager: AuthManager;
}

export interface UseExportReturn {
  exportHtml: (
    templateId: string,
    fonts: ExportFontsPayload,
  ) => Promise<ExportResult>;
  getMjmlSource: (
    templateId: string,
    fonts: ExportFontsPayload,
  ) => Promise<string>;
}

/**
 * Flatten a {@link FontsConfig} into the export payload.
 *
 * Unconditional: gating fonts by entitlement meters no resource Cloud buys, and
 * would only make the paid tier render fewer fonts than the free editor.
 */
export function resolveExportFonts(
  fonts: FontsConfig | undefined,
): ExportFontsPayload {
  return {
    customFonts: fonts?.customFonts ?? [],
    defaultFallback: fonts?.defaultFallback ?? "Arial, sans-serif",
  };
}

/**
 * Cloud's server-side export endpoint, as a plain API wrapper.
 *
 * Both calls render from the **stored** template, so callers save first when the
 * canvas may have moved on — see `createCloudRenderProvider`, which is where that
 * policy lives.
 */
export function useExport(options: UseExportOptions): UseExportReturn {
  const api = new ApiClient(options.authManager);

  async function exportHtml(
    templateId: string,
    fonts: ExportFontsPayload,
  ): Promise<ExportResult> {
    const result = await api.exportTemplate(templateId, fonts);

    return {
      html: result.html,
      mjml: result.mjml,
    };
  }

  async function getMjmlSource(
    templateId: string,
    fonts: ExportFontsPayload,
  ): Promise<string> {
    const result = await api.exportTemplate(templateId, fonts);
    return result.mjml;
  }

  return {
    exportHtml,
    getMjmlSource,
  };
}
