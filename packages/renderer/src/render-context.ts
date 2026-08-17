import type { Block, BlockType, CustomFont } from "@templatical/types";
import pkg from "../package.json" with { type: "json" };

/**
 * A function type that renders a single block to MJML markup.
 */
export type BlockRenderer = (block: Block, context: RenderContext) => string;

/**
 * Per-block-type renderer overrides, keyed by `block.type`. An entry replaces the
 * built-in renderer for that type wholesale — including its hidden-on-all-
 * viewports check, which becomes the override's responsibility.
 *
 * Generalises `renderCustomBlock`, which is the same idea for one block type. Its
 * reason to exist is that Templatical Cloud's render output is a deliberate
 * *superset*: countdown blocks resolve to a server-generated animated GIF and
 * video thumbnails get a composited play button, neither of which a browser can
 * do at render time. With this hook Cloud's renderer is the published one plus
 * two injected functions, so parity for every other block type holds by
 * construction instead of by review.
 */
export type BlockRendererMap = Partial<Record<BlockType, BlockRenderer>>;

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
    /**
     * Per-block-type renderer overrides from `RenderOptions.blockRenderers`.
     * Consulted before every built-in renderer — see {@link BlockRendererMap}.
     */
    public readonly blockRenderers: BlockRendererMap = {},
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
      this.blockRenderers,
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
