/**
 * Pick the text color with the highest WCAG contrast against a background.
 * Inputs must be #rgb or #rrggbb. Returns `light` on unrecognized input.
 */
export function readableTextColor(
  background: string,
  options: { light?: string; dark?: string } = {},
): string {
  const light = options.light ?? "#ffffff";
  const dark = options.dark ?? "#1f1f1f";

  const rgb = parseHexRgb(background);
  if (!rgb) return light;

  const bgLuminance = relativeLuminance(rgb);
  const lightRgb = parseHexRgb(light);
  const darkRgb = parseHexRgb(dark);
  const lightLuminance = lightRgb ? relativeLuminance(lightRgb) : 1;
  const darkLuminance = darkRgb ? relativeLuminance(darkRgb) : 0;

  const contrastLight = contrastRatio(bgLuminance, lightLuminance);
  const contrastDark = contrastRatio(bgLuminance, darkLuminance);

  return contrastLight >= contrastDark ? light : dark;
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const match = hex.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}
