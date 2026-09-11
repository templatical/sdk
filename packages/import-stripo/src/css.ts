/**
 * Tiny CSS readers for paint that compiled Stripo HTML already inlines.
 * Hex (3/6) and a bare bgcolor hex; "transparent" is unset.
 */

export function parseStyleAttribute(
  styleAttr: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleAttr) return result;
  for (const decl of styleAttr.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

export function parseColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "inherit" || trimmed === "none")
    return "";
  const hex = trimmed.startsWith("#")
    ? trimmed
    : /^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(trimmed)
      ? `#${trimmed}`
      : trimmed;
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return "";
}

export function parsePxValue(value: string | undefined): number {
  if (!value) return 0;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

/** Inline `background-color` / `background` wins over the `bgcolor` attribute. */
export function colorFromPaint(
  styleAttr: string | undefined,
  bgcolor?: string,
): string {
  const styles = parseStyleAttribute(styleAttr);
  const fromShorthand = styles.background
    ? parseColor(styles.background.trim().split(/\s+/)[0])
    : "";
  return (
    parseColor(styles["background-color"]) ||
    fromShorthand ||
    parseColor(bgcolor) ||
    ""
  );
}
