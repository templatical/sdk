import type { SpacingValue } from "@templatical/types";

/**
 * Parses a CSS `style="..."` attribute string into a flat key/value record.
 * Keys are lowercased; values are trimmed. Quotes around values are not stripped.
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

/**
 * Serializes a flat key/value record back to a `style` attribute string.
 */
export function serializeStyleAttribute(
  styles: Record<string, string>,
): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

/**
 * Parses a px-like CSS value (`"12px"`, `"12"`, `12`) into a rounded integer.
 * Returns 0 for missing or unparseable input. Ignores em/% units.
 */
export function parsePxValue(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

/**
 * Parses a width value that may be a percentage. Returns the numeric percent
 * (0-100). For non-percent values, returns 100.
 */
export function parseWidthPercent(value: string | undefined): number {
  if (!value) return 100;
  const match = value.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (match) return Math.round(parseFloat(match[1]));
  return 100;
}

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  teal: "#008080",
  navy: "#000080",
  fuchsia: "#ff00ff",
  purple: "#800080",
  orange: "#ffa500",
  pink: "#ffc0cb",
};

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const hex = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Normalizes a CSS color value to a 6-digit lowercase hex string.
 * - 3-digit hex expands to 6-digit
 * - rgb()/rgba() converts to hex (alpha is dropped)
 * - Named colors map via lookup
 * - "transparent" / unknown returns ""
 */
export function parseColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "inherit" || trimmed === "none")
    return "";

  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgbMatch) {
    return rgbToHex(
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    );
  }

  if (NAMED_COLORS[trimmed]) return NAMED_COLORS[trimmed];

  return "";
}

/**
 * Parses a CSS `padding` shorthand (1-4 values) into a SpacingValue.
 */
export function parsePaddingShorthand(value: string | undefined): SpacingValue {
  if (!value) return { top: 0, right: 0, bottom: 0, left: 0 };

  const parts = value.trim().split(/\s+/);
  const values = parts.map((p) => parsePxValue(p));

  switch (values.length) {
    case 1:
      return {
        top: values[0],
        right: values[0],
        bottom: values[0],
        left: values[0],
      };
    case 2:
      return {
        top: values[0],
        right: values[1],
        bottom: values[0],
        left: values[1],
      };
    case 3:
      return {
        top: values[0],
        right: values[1],
        bottom: values[2],
        left: values[1],
      };
    default:
      return {
        top: values[0],
        right: values[1],
        bottom: values[2],
        left: values[3],
      };
  }
}

/**
 * Reads CSS padding from a style record, preferring the longhand props
 * (padding-top/right/bottom/left) and falling back to the `padding` shorthand.
 */
export function readPaddingFromStyles(
  styles: Record<string, string>,
): SpacingValue {
  const shorthand = parsePaddingShorthand(styles.padding);
  return {
    top: parsePxValue(styles["padding-top"]) || shorthand.top,
    right: parsePxValue(styles["padding-right"]) || shorthand.right,
    bottom: parsePxValue(styles["padding-bottom"]) || shorthand.bottom,
    left: parsePxValue(styles["padding-left"]) || shorthand.left,
  };
}

/**
 * Strips quotes and returns the first font in a font-family stack.
 */
export function parseFontFamily(value: string | undefined): string {
  if (!value) return "";
  return value
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

/**
 * Normalizes a font-weight value to a string CSS keyword/number that
 * the editor accepts. Returns "" when the value is the default (normal/400).
 */
export function parseFontWeight(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "normal" || trimmed === "400") return "";
  return trimmed;
}

/**
 * Parses CSS text-align to one of the allowed editor alignments.
 */
export function parseAlignment(
  value: string | undefined,
  fallback: "left" | "center" | "right" = "left",
): "left" | "center" | "right" {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "left" || v === "center" || v === "right") return v;
  return fallback;
}

/**
 * Parses a CSS `border` shorthand (`"1px solid #ccc"`) into width/style/color.
 * Order-tolerant: each token is classified by content.
 */
export function parseBorderShorthand(value: string | undefined): {
  width: number;
  style: string;
  color: string;
} {
  const fallback = { width: 0, style: "solid", color: "#000000" };
  if (!value) return fallback;

  const styleKeywords = new Set([
    "none",
    "hidden",
    "dotted",
    "dashed",
    "solid",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ]);

  let width = 0;
  let style = "solid";
  let color = "#000000";

  for (const token of value.trim().split(/\s+/)) {
    const lower = token.toLowerCase();
    if (styleKeywords.has(lower)) {
      style = lower;
    } else if (/^-?\d+(?:\.\d+)?(?:px)?$/i.test(lower)) {
      width = parsePxValue(lower);
    } else {
      const c = parseColor(lower);
      if (c) color = c;
    }
  }

  return { width, style, color };
}
