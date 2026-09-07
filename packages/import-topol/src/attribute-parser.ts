import type { SpacingValue } from "@templatical/types";
import type { TopolNode } from "./types";

/**
 * Read one attribute as a string, treating Topol's explicit `null` — and an
 * empty string — as absent.
 *
 * Topol writes literal `null` for an unset attribute rather than omitting the
 * key, so a `!== undefined` check would report it as present and write a null
 * into the block. Every optional-field read goes through here.
 */
export function attr(node: TopolNode, key: string): string | undefined {
  const raw = node.attributes?.[key];
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "object") return undefined;
  const value = String(raw);
  return value === "" ? undefined : value;
}

/** Read one attribute as a number, or `undefined` when unset or non-numeric. */
export function numAttr(node: TopolNode, key: string): number | undefined {
  const value = attr(node, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Parse a px-like value into a rounded integer. Returns 0 for a missing value
 * and for units the block model cannot express (em, rem, %).
 *
 * Trims first, then matches with no `\s*` on either side of the optional
 * `px` unit. A trailing run of spaces can otherwise be claimed by either the
 * surrounding `\s*` or by backtracking out of the digit/unit match, and a
 * *failing* match (no `px`, no digits — anything not shaped like a length)
 * retries every such split before giving up: `"0" + " ".repeat(n) + "x"` is
 * polynomial in `n` against that pattern. Trimming first removes the only
 * whitespace the pattern needs to tolerate, so the match itself has nothing
 * ambiguous left to backtrack over.
 */
export function parsePxValue(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const trimmed = value.trim();
  const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(trimmed);
  return match ? Math.round(parseFloat(match[1])) : 0;
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
 * Returns `""` for transparent/inherit/none and for anything unrecognised —
 * the empty string is the block model's "unset", which the colour pickers
 * clear to, so it is meaningfully different from returning a default.
 */
export function parseColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "inherit" || trimmed === "none")
    return "";
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const rgb = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  return NAMED_COLORS[trimmed] ?? "";
}

function expandShorthand(value: string | undefined): SpacingValue {
  if (!value) return { top: 0, right: 0, bottom: 0, left: 0 };
  const v = value
    .trim()
    .split(/\s+/)
    .map((p) => parsePxValue(p));
  switch (v.length) {
    case 1:
      return { top: v[0], right: v[0], bottom: v[0], left: v[0] };
    case 2:
      return { top: v[0], right: v[1], bottom: v[0], left: v[1] };
    case 3:
      return { top: v[0], right: v[1], bottom: v[2], left: v[1] };
    default:
      return { top: v[0], right: v[1], bottom: v[2], left: v[3] };
  }
}

/**
 * Read a node's padding, handling both forms Topol emits: a shorthand string
 * (`"9px 9px 9px 9px"`, used by most leaves) and four separate bare-number
 * keys (`padding-top: 24`, used by `mj-divider`). A separate key wins over the
 * shorthand for its own side.
 */
export function parsePadding(node: TopolNode): SpacingValue {
  const base = expandShorthand(attr(node, "padding"));
  const side = (key: string, fallback: number) => {
    const value = attr(node, key);
    return value === undefined ? fallback : parsePxValue(value);
  };
  return {
    top: side("padding-top", base.top),
    right: side("padding-right", base.right),
    bottom: side("padding-bottom", base.bottom),
    left: side("padding-left", base.left),
  };
}

/**
 * Read a percentage. Returns `null` when the value is not a percentage, so a
 * caller can tell "no width given" from "0%" — column matching depends on that
 * distinction.
 */
export function parsePercent(
  value: string | number | undefined,
): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  return match ? parseFloat(match[1]) : null;
}

/** Strip quotes and return the first family in a stack. */
export function parseFontFamily(value: string | undefined): string {
  if (!value) return "";
  return value
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

/** Narrow an alignment to the three the block model accepts. */
export function parseAlignment(
  value: string | undefined,
  fallback: "left" | "center" | "right" = "left",
): "left" | "center" | "right" {
  const v = (value ?? "").trim().toLowerCase();
  return v === "left" || v === "center" || v === "right" ? v : fallback;
}

/** Narrow a border style to the three `DividerBlock.lineStyle` accepts. */
export function parseBorderStyle(
  value: string | undefined,
): "solid" | "dashed" | "dotted" {
  const v = (value ?? "").trim().toLowerCase();
  return v === "dashed" || v === "dotted" ? v : "solid";
}
