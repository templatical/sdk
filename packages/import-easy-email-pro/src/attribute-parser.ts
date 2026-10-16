import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
} from "@templatical/types";
import { isUnset } from "./normalize";

/** Strip a trailing `px` (case-insensitive) and coerce to number. Unset/NaN → undefined. */
export function parsePx(value: unknown): number | undefined {
  if (isUnset(value)) return undefined;
  let raw = String(value).trim();
  if (raw.toLowerCase().endsWith("px")) raw = raw.slice(0, -2).trimEnd();
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Strip a trailing `%` and coerce to number. Unset/NaN → `null` so
 * `matchColumnLayout` can tell "missing width" from `0%`.
 */
export function parsePercent(value: unknown): number | null {
  if (isUnset(value)) return null;
  let raw = String(value).trim();
  if (raw.endsWith("%")) raw = raw.slice(0, -1).trimEnd();
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** Return the colour string as-is when set. No named-colour expansion. */
export function parseColor(value: unknown): string | undefined {
  if (isUnset(value)) return undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

/** Read the four padding sides via a callback (typically wrapping `readAttr`). Missing → 0. */
export function readPadding(read: (key: string) => unknown): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const side = (key: string) => parsePx(read(key)) ?? 0;
  return {
    top: side("padding-top"),
    right: side("padding-right"),
    bottom: side("padding-bottom"),
    left: side("padding-left"),
  };
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
 * A section or wrapper background image, `null` when `background-url` is
 * unset. Easy Email Pro renders through MJML, so unset attributes take
 * MJML's own defaults and the import paints what the editor painted; a value
 * with no exact keyword takes the nearest one and adds a note naming it.
 * `read` returns an attribute's cascaded value (`readAttr`); `label` names
 * the element in each note, and a px `background-size` is measured against
 * `boxWidth`.
 */
export function readMjmlBackgroundImage(
  read: (name: string) => unknown,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const value = (name: string): string | undefined => {
    const raw = read(name);
    return isUnset(raw) ? undefined : String(raw).trim();
  };

  const url = value("background-url") ?? "";
  if (!url) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = MJML_BACKGROUND_DEFAULTS.size;
  const rawSize = value("background-size");
  if (rawSize) {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("background-size", rawSize, size);
  }

  let x: BackgroundPositionX = MJML_BACKGROUND_DEFAULTS.x;
  let y: BackgroundPositionY = MJML_BACKGROUND_DEFAULTS.y;
  const rawPosition = value("background-position");
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
  const rawX = value("background-position-x");
  if (rawX) {
    const parsed = backgroundAxisPoint(rawX.toLowerCase(), X_GRID);
    x = parsed?.point ?? x;
    if (!parsed?.exact) lossy("background-position-x", rawX, x);
  }
  const rawY = value("background-position-y");
  if (rawY) {
    const parsed = backgroundAxisPoint(rawY.toLowerCase(), Y_GRID);
    y = parsed?.point ?? y;
    if (!parsed?.exact) lossy("background-position-y", rawY, y);
  }

  let repeat: boolean = MJML_BACKGROUND_DEFAULTS.repeat;
  const rawRepeat = value("background-repeat");
  if (rawRepeat) {
    const parsed = backgroundRepeatFlag(rawRepeat);
    repeat = parsed.repeat;
    if (!parsed.exact) {
      lossy("background-repeat", rawRepeat, repeat ? "repeat" : "no-repeat");
    }
  }

  return { image: { url, size, position: { x, y }, repeat }, notes };
}
