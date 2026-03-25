declare module "@templatical/renderer" {
  import type { TemplateContent } from "@templatical/types";

  export interface RenderOptions {
    customFonts?: Array<{ name: string; url: string; fallback?: string }>;
    defaultFallbackFont?: string;
    allowHtmlBlocks?: boolean;
  }

  export function renderToMjml(
    content: TemplateContent,
    options?: RenderOptions,
  ): string;
  export function renderToHtml(
    content: TemplateContent,
    options?: RenderOptions,
  ): Promise<string>;
}
