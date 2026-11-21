declare module "@templatical/renderer" {
  import type {
    Block,
    CountdownBlock,
    CustomBlock,
    TemplateContent,
  } from "@templatical/types";

  export interface RenderOptions {
    locale?: string;
    customFonts?: Array<{ name: string; url: string; fallback?: string }>;
    defaultFallbackFont?: string;
    allowHtmlBlocks?: boolean;
    renderCustomBlock?: (block: CustomBlock) => Promise<string>;
    socialIconsBaseUrl?: string;
    layout?: TemplateContent;
    blockRenderers?: Partial<Record<string, (block: Block) => string>>;
  }

  export function renderToMjml(
    content: TemplateContent,
    options?: RenderOptions,
  ): Promise<string>;

  export function renderCountdownImage(
    block: CountdownBlock,
    src: string,
    options?: { locale?: string },
  ): string;
}
