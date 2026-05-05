/**
 * WCAG 2.1 sRGB relative-luminance contrast.
 *
 * Inputs are hex strings (`#rgb`, `#rrggbb`, optional leading `#`).
 * Returns the contrast ratio (1–21) per WCAG, or `NaN` if either input
 * cannot be parsed as an opaque solid hex color.
 *
 * The codebase uses OKLch for design tokens, but contrast math is
 * sRGB-defined; mixing the two gives incorrect results.
 */
export function getContrastRatio(fg: string, bg: string): number {
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);

  if (!fgRgb || !bgRgb) {
    return Number.NaN;
  }

  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function parseHex(input: string | undefined | null): Rgb | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  const match6 = HEX6.exec(trimmed);
  if (match6) {
    return {
      r: parseInt(match6[1], 16),
      g: parseInt(match6[2], 16),
      b: parseInt(match6[3], 16),
    };
  }

  const match3 = HEX3.exec(trimmed);
  if (match3) {
    return {
      r: parseInt(match3[1] + match3[1], 16),
      g: parseInt(match3[2] + match3[2], 16),
      b: parseInt(match3[3] + match3[3], 16),
    };
  }

  return null;
}

export function isOpaqueHex(input: string | undefined | null): boolean {
  return parseHex(input ?? "") !== null;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const rs = channel(r / 255);
  const gs = channel(g / 255);
  const bs = channel(b / 255);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function channel(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
