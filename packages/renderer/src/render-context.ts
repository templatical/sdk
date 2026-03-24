import type { CustomFont } from '@templatical/types';

/**
 * Immutable context passed through the block rendering chain.
 */
export class RenderContext {
  constructor(
    public readonly containerWidth: number,
    public readonly customFonts: CustomFont[],
    public readonly defaultFallbackFont: string,
    public readonly allowHtmlBlocks: boolean,
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
    );
  }

  /**
   * Resolve a font family name to include custom font fallbacks.
   * If the font matches a custom font, returns `'FontName', fallback`.
   * Otherwise returns the original font family string.
   */
  resolveFontFamily(fontFamily: string): string {
    for (const customFont of this.customFonts) {
      if (customFont.name.toLowerCase() === fontFamily.toLowerCase()) {
        const fallback = customFont.fallback ?? this.defaultFallbackFont;

        return `'${customFont.name}', ${fallback}`;
      }
    }

    return fontFamily;
  }
}
