import { canonicalFontStack } from "@templatical/types";
import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SpacingValue,
} from "@templatical/types";
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

function isSpace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function skipSpaces(s: string, i: number): number {
  while (i < s.length && isSpace(s[i]!)) i++;
  return i;
}

/**
 * `"2px solid #00a591"` — width, style, colour.
 *
 * Linear: a regex whose last two tokens are "spaces, then the rest of the
 * string" is polynomial on a long run of spaces after the style word
 * (`js/polynomial-redos`). Every character here is visited at most once.
 */
function parseCssBorder(value: unknown): CssBorder | undefined {
  if (isUnset(value) || typeof value !== "string") return undefined;
  const s = value.trim();
  let i = 0;
  const numStart = i;
  while (i < s.length && s[i]! >= "0" && s[i]! <= "9") i++;
  if (i < s.length && s[i] === ".") {
    i++;
    while (i < s.length && s[i]! >= "0" && s[i]! <= "9") i++;
  }
  if (i === numStart) return undefined;
  const width = Math.round(parseFloat(s.slice(numStart, i)));
  if (s.slice(i, i + 2).toLowerCase() !== "px") return undefined;
  i += 2;
  i = skipSpaces(s, i);
  const styleStart = i;
  while (i < s.length && !isSpace(s[i]!)) i++;
  const styleWord = s.slice(styleStart, i).toLowerCase();
  if (
    styleWord !== "solid" &&
    styleWord !== "dashed" &&
    styleWord !== "dotted"
  ) {
    return undefined;
  }
  i = skipSpaces(s, i);
  if (i >= s.length) return undefined;
  const color = parseColor(s.slice(i));
  if (color === undefined || width === 0) return undefined;
  return { width, style: styleWord, color };
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

/** The font stack to store, or `undefined` when `value` sets no font. */
export function fontStack(value: unknown): string | undefined {
  if (isUnset(value)) return undefined;
  return canonicalFontStack(value) || undefined;
}

/** A background image read from the source, with a note for each value that had no exact keyword. */
export interface ReadBackgroundImage {
  image: BackgroundImage;
  notes: string[];
}

const X_GRID = ["left", "center", "right"] as const;
const Y_GRID = ["top", "center", "bottom"] as const;
const PERCENT = /^(-?\d*\.?\d+)%$/;
const LENGTH = /^-?\d*\.?\d+[a-z]*$/;

/**
 * `background-size` as a keyword. A size with a side at 100%, or a px width
 * spanning the box, fills it as `cover` does; any other length or percentage
 * draws the image at a size of its own, which `auto` is closest to.
 */
function backgroundSizeKeyword(
  raw: string,
  boxWidth: number | undefined,
): { size: BackgroundSize; exact: boolean } {
  const parts = raw.toLowerCase().split(/\s+/);
  const [first] = parts;
  if (parts.length === 1 && (first === "cover" || first === "contain")) {
    return { size: first, exact: true };
  }
  if (parts.every((part) => part === "auto")) {
    return { size: "auto", exact: true };
  }
  const px = /^(\d*\.?\d+)px$/.exec(first);
  const fills =
    parts.includes("100%") ||
    (px !== null && boxWidth !== undefined && Number(px[1]) >= boxWidth);
  return { size: fills ? "cover" : "auto", exact: false };
}

/**
 * `background-position` split into x and y the way MJML and CSS read it: a
 * lone `top` / `bottom` names y and centres x, any other lone value is x
 * with y centred, and a pair is x then y unless it leads with `top` /
 * `bottom` (or with `center` before `left` / `right`). Three- and four-value
 * edge offsets keep their edge keywords only.
 */
function splitBackgroundPosition(raw: string): {
  x: string;
  y: string;
  exact: boolean;
} {
  const parts = raw.toLowerCase().split(/\s+/);
  if (parts.length === 1) {
    const [only] = parts;
    return only === "top" || only === "bottom"
      ? { x: "center", y: only, exact: true }
      : { x: only, y: "center", exact: true };
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    const yFirst =
      a === "top" ||
      a === "bottom" ||
      (a === "center" && (b === "left" || b === "right"));
    return yFirst ? { x: b, y: a, exact: true } : { x: a, y: b, exact: true };
  }
  return {
    x: parts.find((part) => part === "left" || part === "right") ?? "center",
    y: parts.find((part) => part === "top" || part === "bottom") ?? "center",
    exact: false,
  };
}

/**
 * One axis as a grid point: its keyword; the point nearest a percentage,
 * ties going to the centre; or the start edge for a length, which is an
 * offset from it. `null` when the token is unreadable.
 */
function backgroundAxisPoint<T extends string>(
  token: string,
  grid: readonly [T, T, T],
): { point: T; exact: boolean } | null {
  const keyword = grid.find((point) => point === token);
  if (keyword) return { point: keyword, exact: true };
  const percent = PERCENT.exec(token);
  if (percent) {
    const n = Number(percent[1]);
    return {
      point: n < 25 ? grid[0] : n > 75 ? grid[2] : grid[1],
      exact: n === 0 || n === 50 || n === 100,
    };
  }
  if (LENGTH.test(token)) {
    return { point: grid[0], exact: parseFloat(token) === 0 };
  }
  return null;
}

/**
 * `background-repeat`: unrepeated only when every axis is `no-repeat`.
 * Anything but plain `repeat` tiles too, inexactly.
 */
function backgroundRepeatFlag(raw: string): {
  repeat: boolean;
  exact: boolean;
} {
  const parts = raw.toLowerCase().split(/\s+/);
  if (parts.every((part) => part === "no-repeat")) {
    return { repeat: false, exact: true };
  }
  return { repeat: true, exact: parts.every((part) => part === "repeat") };
}

/** CSS's initial values: what a browser paints for a longhand Chamaileon leaves out. */
const CSS_BACKGROUND_DEFAULTS = {
  size: "auto",
  x: "left",
  y: "top",
  repeat: true,
} as const;

const URL_FUNCTION = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/i;

/** The URL inside a CSS `url(…)`, unquoted and trimmed; "" when there is none. */
function cssUrl(value: string | undefined): string {
  const match = URL_FUNCTION.exec(value ?? "");
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

/**
 * A background image from a Chamaileon style map, `null` when
 * `${prefix}Image` holds no `url()`. `prefix` picks the band
 * (`background*`, also a box's and the body's) or a fullwidth's content area
 * (`contentBackground*`). Unset longhands take CSS's initial values; a value
 * with no exact keyword takes the nearest one and adds a note naming it.
 */
export function readChamaileonBackgroundImage(
  style: Record<string, unknown>,
  prefix: "background" | "contentBackground",
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const value = (suffix: string): string | undefined => {
    const raw = styleValue(style, `${prefix}${suffix}`);
    return isUnset(raw) ? undefined : String(raw).trim();
  };

  const url = cssUrl(value("Image"));
  if (!url) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = CSS_BACKGROUND_DEFAULTS.size;
  const rawSize = value("Size");
  if (rawSize) {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("background-size", rawSize, size);
  }

  let x: BackgroundPositionX = CSS_BACKGROUND_DEFAULTS.x;
  let y: BackgroundPositionY = CSS_BACKGROUND_DEFAULTS.y;
  const rawPosition = value("Position");
  if (rawPosition) {
    const split = splitBackgroundPosition(rawPosition);
    const readX = backgroundAxisPoint(split.x, X_GRID);
    const readY = backgroundAxisPoint(split.y, Y_GRID);
    x = readX?.point ?? x;
    y = readY?.point ?? y;
    if (!split.exact || !readX?.exact || !readY?.exact) {
      lossy("background-position", rawPosition, `${x} ${y}`);
    }
  }

  let repeat: boolean = CSS_BACKGROUND_DEFAULTS.repeat;
  const rawRepeat = value("Repeat");
  if (rawRepeat) {
    const parsed = backgroundRepeatFlag(rawRepeat);
    repeat = parsed.repeat;
    if (!parsed.exact) {
      lossy("background-repeat", rawRepeat, repeat ? "repeat" : "no-repeat");
    }
  }

  return { image: { url, size, position: { x, y }, repeat }, notes };
}
