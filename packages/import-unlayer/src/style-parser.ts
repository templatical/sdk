import { canonicalFontStack } from "@templatical/types";
import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SpacingValue,
} from "@templatical/types";
import type {
  UnlayerBackgroundImage,
  UnlayerBorder,
  UnlayerFontFamily,
} from "./types";

/**
 * Parses CSS-like style values from Unlayer content values.
 */

export function parsePxValue(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return Math.round(value);
  // Single trailing-whitespace group with an optional `px` inside it. The
  // original `\s*(?:px)?\s*` had two `\s*` quantifiers around an optional
  // group, which is the textbook polynomial-ReDoS shape ("how should the
  // whitespace split across the two quantifiers?") over inputs like
  // `9                ` with no `px`.
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:px\s*)?$/);
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
  value: string | number | undefined,
  width: number | undefined,
  height: number | undefined,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    return value > 0 ? Math.round(value) : undefined;
  }

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

export function parseColor(value: string | undefined): string {
  if (!value || value === "transparent") return "";

  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return trimmed;
}

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

export function parseBorderObject(border: UnlayerBorder | undefined): {
  width: number;
  style: string;
  color: string;
} {
  if (!border) return { width: 0, style: "solid", color: "#000000" };
  return {
    width: parsePxValue(border.borderTopWidth),
    style: border.borderTopStyle || "solid",
    color: parseColor(border.borderTopColor) || "#000000",
  };
}

/**
 * A divider's `width` as a percentage or a px length; a unitless value is px.
 * `undefined` for anything else. The sign survives, so the caller can clamp.
 */
export function parseDividerWidth(
  value: string | number,
): { unit: "%" | "px"; value: number } | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { unit: "px", value } : undefined;
  }
  // One `\s*` before the unit, so there is a single way to match trailing
  // whitespace (see `parsePxValue` for the two-quantifier ReDoS shape).
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(%|px)?$/);
  if (!match) return undefined;
  return { unit: match[2] === "%" ? "%" : "px", value: parseFloat(match[1]) };
}

/**
 * The font stack to store for an Unlayer `fontFamily`, which is either a CSS
 * string or a `{ label, value }` pick from Unlayer's font list. The label is
 * read only when `value` sets no font.
 */
export function parseFontFamily(
  value: UnlayerFontFamily | string | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") return canonicalFontStack(value);
  return canonicalFontStack(value.value) || canonicalFontStack(value.label);
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

const UNLAYER_POSITIONS: Readonly<
  Record<string, { x: BackgroundPositionX; y: BackgroundPositionY }>
> = {
  "top-left": { x: "left", y: "top" },
  "top-center": { x: "center", y: "top" },
  "top-right": { x: "right", y: "top" },
  "center-left": { x: "left", y: "center" },
  center: { x: "center", y: "center" },
  "center-right": { x: "right", y: "center" },
  "bottom-left": { x: "left", y: "bottom" },
  "bottom-center": { x: "center", y: "bottom" },
  "bottom-right": { x: "right", y: "bottom" },
};

/**
 * A CSS `background-size` as a keyword. A size with a side at 100%, or a px
 * width spanning the box, fills it as `cover` does; any other length or
 * percentage draws the image at a size of its own, which `auto` is closest to.
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
 * An Unlayer row's `backgroundImage`, `null` when its `url` is blank. Unset
 * fields take Unlayer's editor defaults: `custom` size, which is the image at
 * its own size (`auto`), `center`, and `no-repeat`. A `custom` position reads
 * `customPosition` as CSS. A value with no exact keyword takes the nearest
 * one and adds a note naming it. Older designs carry `cover` and `center`
 * booleans instead of `size` and `position`; they map exactly, and only when
 * the string field is absent.
 */
export function readUnlayerBackgroundImage(
  bg: UnlayerBackgroundImage | undefined,
  label: string,
  boxWidth: number,
): ReadBackgroundImage | null {
  const url = typeof bg?.url === "string" ? bg.url.trim() : "";
  if (!bg || !url) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = "auto";
  const rawSize = typeof bg.size === "string" ? bg.size.trim() : "";
  if (rawSize === "cover" || rawSize === "contain") {
    size = rawSize;
  } else if (rawSize && rawSize !== "custom") {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("backgroundImage.size", rawSize, size);
  } else if (!rawSize && typeof bg.cover === "boolean") {
    size = bg.cover ? "cover" : "auto";
  }

  let x: BackgroundPositionX = "center";
  let y: BackgroundPositionY = "center";
  const rawPosition = typeof bg.position === "string" ? bg.position.trim() : "";
  if (rawPosition === "custom") {
    const [rawX = "", rawY = ""] = Array.isArray(bg.customPosition)
      ? bg.customPosition.map((part) => String(part).trim())
      : [];
    const readX = backgroundAxisPoint(rawX.toLowerCase(), X_GRID);
    const readY = backgroundAxisPoint(rawY.toLowerCase(), Y_GRID);
    x = readX?.point ?? x;
    y = readY?.point ?? y;
    if (!readX?.exact || !readY?.exact) {
      lossy(
        "backgroundImage.customPosition",
        `${rawX} ${rawY}`.trim(),
        `${x} ${y}`,
      );
    }
  } else if (rawPosition) {
    const keyword = Object.hasOwn(UNLAYER_POSITIONS, rawPosition)
      ? UNLAYER_POSITIONS[rawPosition]
      : undefined;
    if (keyword) {
      x = keyword.x;
      y = keyword.y;
    } else {
      lossy("backgroundImage.position", rawPosition, `${x} ${y}`);
    }
  } else if (typeof bg.center === "boolean") {
    x = bg.center ? "center" : "left";
    y = "top";
  }

  let repeat = false;
  if (typeof bg.repeat === "boolean") {
    repeat = bg.repeat;
  } else if (typeof bg.repeat === "string" && bg.repeat.trim()) {
    const rawRepeat = bg.repeat.trim();
    repeat = rawRepeat !== "no-repeat";
    if (repeat && rawRepeat !== "repeat") {
      lossy("backgroundImage.repeat", rawRepeat, "repeat");
    }
  }

  return { image: { url, size, position: { x, y }, repeat }, notes };
}
