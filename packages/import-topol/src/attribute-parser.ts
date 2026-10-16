import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SpacingValue,
} from "@templatical/types";
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

/** A background image read from the source, with a note for each value that had no exact keyword. */
export interface ReadBackgroundImage {
  image: BackgroundImage;
  notes: string[];
}

const X_GRID = ["left", "center", "right"] as const;
const Y_GRID = ["top", "center", "bottom"] as const;
const PERCENT = /^(-?(?:\d+(?:\.\d+)?|\.\d+))%$/;
const LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)[a-z]*$/;

/** What MJML paints for a `background-*` attribute an `mj-section` / `mj-wrapper` leaves out. */
const MJML_BACKGROUND_DEFAULTS = {
  size: "auto",
  x: "center",
  y: "top",
  repeat: true,
} as const;

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
  const px = /^(\d+(?:\.\d+)?|\.\d+)px$/.exec(first);
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

/**
 * An `mj-section` / `mj-wrapper` background image, `null` when
 * `background-url` is absent or blank. `read` returns an attribute's
 * resolved value. Unset attributes take MJML's own defaults, so the import
 * paints what MJML painted; a value with no exact keyword takes the nearest
 * one and adds a note naming it. `label` names the element in each note, and
 * a px `background-size` is measured against `boxWidth`.
 */
export function readMjmlBackgroundImage(
  read: (name: string) => string | undefined,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const url = (read("background-url") ?? "").trim();
  if (!url) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = MJML_BACKGROUND_DEFAULTS.size;
  const rawSize = read("background-size")?.trim();
  if (rawSize) {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("background-size", rawSize, size);
  }

  let x: BackgroundPositionX = MJML_BACKGROUND_DEFAULTS.x;
  let y: BackgroundPositionY = MJML_BACKGROUND_DEFAULTS.y;
  const rawPosition = read("background-position")?.trim();
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
  const rawX = read("background-position-x")?.trim();
  if (rawX) {
    const parsed = backgroundAxisPoint(rawX.toLowerCase(), X_GRID);
    x = parsed?.point ?? x;
    if (!parsed?.exact) lossy("background-position-x", rawX, x);
  }
  const rawY = read("background-position-y")?.trim();
  if (rawY) {
    const parsed = backgroundAxisPoint(rawY.toLowerCase(), Y_GRID);
    y = parsed?.point ?? y;
    if (!parsed?.exact) lossy("background-position-y", rawY, y);
  }

  let repeat: boolean = MJML_BACKGROUND_DEFAULTS.repeat;
  const rawRepeat = read("background-repeat")?.trim();
  if (rawRepeat) {
    const parsed = backgroundRepeatFlag(rawRepeat);
    repeat = parsed.repeat;
    if (!parsed.exact) {
      lossy("background-repeat", rawRepeat, repeat ? "repeat" : "no-repeat");
    }
  }

  return { image: { url, size, position: { x, y }, repeat }, notes };
}
