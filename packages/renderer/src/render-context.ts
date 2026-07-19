import type { CustomFont } from "@templatical/types";
import pkg from "../package.json" with { type: "json" };

export const DEFAULT_SOCIAL_ICONS_BASE_URL = `https://cdn.jsdelivr.net/npm/@templatical/renderer@${pkg.version}/assets/social`;

const BUILT_IN_FONT_FALLBACKS: Record<string, string> = {
  arial: "Arial, sans-serif",
  helvetica: "Helvetica, sans-serif",
  georgia: "Georgia, serif",
  "times new roman": "'Times New Roman', serif",
  verdana: "Verdana, sans-serif",
  "trebuchet ms": "'Trebuchet MS', sans-serif",
  "courier new": "'Courier New', monospace",
  tahoma: "Tahoma, sans-serif",
};

/**
 * Immutable context passed through the block rendering chain.
 */
export class RenderContext {
  constructor(
    public readonly containerWidth: number,
    public readonly customFonts: CustomFont[],
    public readonly defaultFallbackFont: string,
    public readonly allowHtmlBlocks: boolean,
    /**
     * Map of custom block id → pre-rendered HTML, populated by `renderToMjml`
     * before the synchronous render pass. Set when the consumer provides a
     * `renderCustomBlock` option. Empty by default.
     */
    public readonly customBlockHtml: ReadonlyMap<string, string> = new Map(),
    /**
     * Base URL (no trailing slash) for the social icon PNG assets. Resolved to
     * `${baseUrl}/${style}/${platform}.png`. Outlook desktop has no SVG support
     * and rejects base64 data URIs in `<img src>`, so PNGs must be served over
     * HTTP. Default points at the version-pinned jsDelivr mirror of this
     * package; consumers can override to self-host.
     */
    public readonly socialIconsBaseUrl: string = DEFAULT_SOCIAL_ICONS_BASE_URL,
  ) {}

  /**
   * Create a new context with a different container width.
   * Used when rendering columns with narrower widths.
   */
  withContainerWidth(width: number): RenderContext {
    return new RenderContext(
      width,
      this.customFonts,
      this.defaultFallbackFont,
      this.allowHtmlBlocks,
      this.customBlockHtml,
      this.socialIconsBaseUrl,
    );
  }

  /**
   * Resolve a font family name to include custom font fallbacks.
   * If the font matches a custom font, returns `'FontName', fallback`.
   * Otherwise returns the original font family string.
   */
  resolveFontFamily(fontFamily: string): string {
    // Check custom fonts first
    for (const customFont of this.customFonts) {
      if (customFont.name.toLowerCase() === fontFamily.toLowerCase()) {
        const fallback = customFont.fallback ?? this.defaultFallbackFont;

        return `'${customFont.name}', ${fallback}`;
      }
    }

    // Resolve built-in fonts to include fallback stacks
    const builtIn = BUILT_IN_FONT_FALLBACKS[fontFamily.toLowerCase()];
    if (builtIn) {
      return builtIn;
    }

    return fontFamily;
  }
}
