import type { SpacingValue } from "@templatical/types";
import { isUnset, styleValue } from "./normalize";

/**
 * Parse a px-like value into a rounded integer. Returns `undefined` when unset
 * or for units the block model cannot express (em, rem, %).
 *
 * Trims first, then matches with no surrounding `\s*` so a failing match cannot
 * backtrack across trailing spaces.
 */
export function parsePx(value: unknown): number | undefined {
  if (isUnset(value)) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  return match ? Math.round(parseFloat(match[1])) : undefined;
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
 * Normalize a colour to 6-digit lowercase hex.
 *
 * Returns `undefined` for unset inputs (including transparent) and for anything
 * unrecognised — optional colour fields stay omitted rather than empty string.
 */
export function parseColor(value: unknown): string | undefined {
  if (isUnset(value)) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "inherit" || trimmed === "none")
    return undefined;
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const rgb = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  return NAMED_COLORS[trimmed];
}

/** Read split padding sides from a normalized style map; missing sides are 0. */
export function parsePadding(style: Record<string, unknown>): SpacingValue {
  const side = (key: string) => parsePx(styleValue(style, key)) ?? 0;
  return {
    top: side("paddingTop"),
    right: side("paddingRight"),
    bottom: side("paddingBottom"),
    left: side("paddingLeft"),
  };
}

/** Narrow an alignment to the three the block model accepts. */
export function parseAlignment(
  value: unknown,
  fallback: "left" | "center" | "right",
): "left" | "center" | "right" {
  if (typeof value !== "string") return fallback;
  const v = value.trim().toLowerCase();
  return v === "left" || v === "center" || v === "right" ? v : fallback;
}

type CssBorder = {
  width: number;
  style: "solid" | "dashed" | "dotted";
  color: string;
};

function parseCssBorder(value: unknown): CssBorder | undefined {
  if (isUnset(value) || typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)px\s+(solid|dashed|dotted)\s+(.+)$/i.exec(
    value.trim(),
  );
  if (!match) return undefined;
  const width = Math.round(parseFloat(match[1]));
  if (width === 0) return undefined;
  const color = parseColor(match[3]);
  if (color === undefined) return undefined;
  return {
    width,
    style: match[2].toLowerCase() as CssBorder["style"],
    color,
  };
}

/** Parse a CSS border shorthand for outlined buttons / leaf borders. */
export function parseBorderShorthand(value: unknown): CssBorder | undefined {
  return parseCssBorder(value);
}

/** Parse a 2.0 divider `attrs.lineStyle` string into thickness/lineStyle/color. */
export function parseLineStyle(value: unknown):
  | {
      thickness: number;
      lineStyle: "solid" | "dashed" | "dotted";
      color: string;
    }
  | undefined {
  const border = parseCssBorder(value);
  if (!border) return undefined;
  return {
    thickness: border.width,
    lineStyle: border.style,
    color: border.color,
  };
}

/** Strip quotes and return the first family in a stack. */
export function firstFamily(value: unknown): string | undefined {
  if (isUnset(value) || typeof value !== "string") return undefined;
  const family = value
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  return family === "" ? undefined : family;
}
