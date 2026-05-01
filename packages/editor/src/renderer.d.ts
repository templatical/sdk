declare module "@templatical/renderer" {
  import type { CustomBlock, TemplateContent } from "@templatical/types";

  export interface RenderOptions {
    customFonts?: Array<{ name: string; url: string; fallback?: string }>;
    defaultFallbackFont?: string;
    allowHtmlBlocks?: boolean;
    renderCustomBlock?: (block: CustomBlock) => Promise<string>;
  }

  export function renderToMjml(
    content: TemplateContent,
    options?: RenderOptions,
  ): Promise<string>;
}
