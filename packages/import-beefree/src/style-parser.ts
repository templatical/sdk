import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SpacingValue,
} from "@templatical/types";

/**
 * Parses CSS-like style values from BeeFree descriptors.
 */

/**
 * The CSS-wide keywords. Each one defers to the cascade instead of naming a
 * value, and a block field that carried one would reach the renderer
 * verbatim, so the parsers read them as unset and the caller's fallback
 * applies.
 */
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "unset", "revert"]);

function isCssWideKeyword(value: string): boolean {
  return CSS_WIDE_KEYWORDS.has(value.trim().toLowerCase());
}

export function parsePxValue(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*px/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

/**
 * An image's corner radius in px, or `undefined` for square corners.
 *
 * Accepts a percentage as well as a px length, because `border-radius: 50%` is
 * the idiomatic way to write a circular avatar and the block stores px only. A
 * percentage resolves against the shorter rendered side, which is what turns a
 * square image into a circle and a wide one into a pill.
 *
 * `width` and `height` must be the dimensions actually read from the source. A
 * percentage with neither known is dropped rather than resolved against the
 * caller's fallback width, which would invent a radius the template never
 * expressed. A non-positive result is dropped for the same reason a px `0` is:
 * both mean square, and only absence keeps it out of the exported JSON.
 */
export function parseImageBorderRadius(
  value: string | undefined,
  width: number | undefined,
  height: number | undefined,
): number | undefined {
  if (!value) return undefined;

  // Deliberately no `-?`: a negative percentage falls through to the px parse,
  // which rejects it too.
  const percent = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) {
    const side = Math.min(width ?? Infinity, height ?? Infinity);
    if (!Number.isFinite(side)) return undefined;
    const radius = Math.round((parseFloat(percent[1]) / 100) * side);
    return radius > 0 ? radius : undefined;
  }

  const px = parsePxValue(value);
  return px > 0 ? px : undefined;
}

/**
 * A color as lowercase 6-digit hex where it is hex, otherwise as written.
 *
 * `""` means unset: returned for transparent, `none` and the CSS-wide
 * keywords, so the caller's fallback applies.
 */
export function parseColor(value: string | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  const keyword = trimmed.toLowerCase();
  if (
    keyword === "transparent" ||
    keyword === "none" ||
    isCssWideKeyword(keyword)
  )
    return "";

  // Already a valid hex color
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();

  // 3-digit hex → 6-digit
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  // Return as-is for rgb(), named colors, etc.
  return trimmed;
}

export function parseBorderTop(value: string | undefined): {
  width: number;
  style: string;
  color: string;
} {
  if (!value) return { width: 0, style: "solid", color: "#000000" };

  // "2px solid #cccccc"
  const parts = value.trim().split(/\s+/);
  return {
    width: parsePxValue(parts[0]),
    style: parts[1] || "solid",
    color: parseColor(parts[2]) || "#000000",
  };
}

export function extractPadding(
  style: Record<string, string> | undefined,
): SpacingValue {
  if (!style) return { top: 0, right: 0, bottom: 0, left: 0 };

  // Check for shorthand `padding` first
  if (style.padding) {
    return parseShorthandPadding(style.padding);
  }

  return {
    top: parsePxValue(style["padding-top"]),
    right: parsePxValue(style["padding-right"]),
    bottom: parsePxValue(style["padding-bottom"]),
    left: parsePxValue(style["padding-left"]),
  };
}

function parseShorthandPadding(value: string): SpacingValue {
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
 * A divider's `width` as a number and its unit, or `undefined` when it is
 * neither a px nor a % length (`auto`, a keyword, anything unreadable).
 */
export function parseDividerWidth(
  value: string,
): { value: number; unit: "px" | "%" } | undefined {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(%|px)$/);
  if (!match) return undefined;
  return { value: parseFloat(match[1]), unit: match[2] === "%" ? "%" : "px" };
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

/** CSS's initial values: what a browser paints for a longhand BeeFree leaves out. */
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
 * A row's background image from a BeeFree style map (`content.style` or
 * `container.style`), `null` when `background-image` holds no `url()`.
 * Unset longhands take CSS's initial values; a value with no exact keyword
 * takes the nearest one and adds a note naming it. `label` names the element
 * in each note, and a px `background-size` is measured against `boxWidth`.
 */
export function readBeefreeBackgroundImage(
  style: Record<string, string> | undefined,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const url = cssUrl(style?.["background-image"]);
  if (!url) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = CSS_BACKGROUND_DEFAULTS.size;
  const rawSize = style?.["background-size"]?.trim();
  if (rawSize) {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("background-size", rawSize, size);
  }

  let x: BackgroundPositionX = CSS_BACKGROUND_DEFAULTS.x;
  let y: BackgroundPositionY = CSS_BACKGROUND_DEFAULTS.y;
  const rawPosition = style?.["background-position"]?.trim();
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
  const rawRepeat = style?.["background-repeat"]?.trim();
  if (rawRepeat) {
    const parsed = backgroundRepeatFlag(rawRepeat);
    repeat = parsed.repeat;
    if (!parsed.exact) {
      lossy("background-repeat", rawRepeat, repeat ? "repeat" : "no-repeat");
    }
  }

  return { image: { url, size, position: { x, y }, repeat }, notes };
}
