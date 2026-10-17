import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SectionHero,
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
  let lossyX = false;
  let lossyY = false;
  const rawPosition = value("background-position");
  if (rawPosition) {
    const split = splitBackgroundPosition(rawPosition);
    const readX = backgroundAxisPoint(split.x, X_GRID);
    const readY = backgroundAxisPoint(split.y, Y_GRID);
    x = readX?.point ?? x;
    y = readY?.point ?? y;
    lossyX = !split.exact || !readX?.exact;
    lossyY = !split.exact || !readY?.exact;
  }
  // A readable `-x` / `-y` replaces its axis, and with it whatever the
  // position lost there; the position's note then names what was imported.
  const rawX = value("background-position-x");
  const overrideX = rawX
    ? backgroundAxisPoint(rawX.toLowerCase(), X_GRID)
    : null;
  if (overrideX) {
    x = overrideX.point;
    lossyX = false;
  }
  const rawY = value("background-position-y");
  const overrideY = rawY
    ? backgroundAxisPoint(rawY.toLowerCase(), Y_GRID)
    : null;
  if (overrideY) {
    y = overrideY.point;
    lossyY = false;
  }
  if (rawPosition && (lossyX || lossyY)) {
    lossy("background-position", rawPosition, `${x} ${y}`);
  }
  if (rawX && !overrideX?.exact) lossy("background-position-x", rawX, x);
  if (rawY && !overrideY?.exact) lossy("background-position-y", rawY, y);

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

/** A section hero read from a `standard-hero`, with a note for each value it couldn't carry. */
export interface ReadHero {
  /** `null` for a content-height hero, which a regular section paints exactly. */
  hero: SectionHero | null;
  image: BackgroundImage | null;
  notes: string[];
}

const HERO_ALIGNS = ["top", "middle", "bottom"] as const;

const HERO_DROPPED_ATTRIBUTES = [
  "inner-padding",
  "inner-padding-top",
  "inner-padding-right",
  "inner-padding-bottom",
  "inner-padding-left",
  "inner-background-color",
];

/**
 * A `standard-hero`'s mode, height and background. Easy Email Pro renders it
 * as an MJML `mj-hero`, so unset attributes take mj-hero's defaults
 * (`fixed-height`, `0px`, `center center`, `vertical-align: top`), and its
 * image is always `cover` and unrepeated. `background-width` /
 * `background-height` are stored as the image's `naturalWidth` /
 * `naturalHeight`, though they are often the hero box's size rather than the
 * file's: only their ratio is used. A `fixed-height` hero without a positive
 * `height` is as tall as its content, exactly what a regular section with the
 * same background paints, so it comes back without `hero`.
 */
export function readMjmlHero(
  read: (name: string) => unknown,
  label: string,
  boxWidth: number | undefined,
): ReadHero {
  const value = (name: string): string | undefined => {
    const raw = read(name);
    return isUnset(raw) ? undefined : String(raw).trim();
  };
  const notes: string[] = [];

  const background = readMjmlBackgroundImage(
    (name) => {
      if (name === "background-size") return "cover";
      if (name === "background-repeat") return "no-repeat";
      if (name === "background-position") {
        return value(name) ?? "center center";
      }
      if (
        name === "background-position-x" ||
        name === "background-position-y"
      ) {
        return undefined;
      }
      return read(name);
    },
    label,
    boxWidth,
  );
  if (background) notes.push(...background.notes);

  const width = parsePx(value("background-width"));
  const height = parsePx(value("background-height"));
  const sized =
    width !== undefined && height !== undefined && width > 0 && height > 0;
  const image = background
    ? {
        ...background.image,
        ...(sized ? { naturalWidth: width, naturalHeight: height } : {}),
      }
    : null;

  const rawAlign = value("vertical-align");
  const verticalAlign =
    HERO_ALIGNS.find((align) => align === rawAlign?.toLowerCase()) ?? "top";
  if (rawAlign && verticalAlign !== rawAlign.toLowerCase()) {
    notes.push(
      `${label} vertical-align "${rawAlign}" has no Templatical equivalent; imported as "top".`,
    );
  }

  const rawMode = value("mode");
  const mode = rawMode ? rawMode.toLowerCase() : "fixed-height";
  let hero: SectionHero | null = null;
  if (mode === "fluid-height") {
    hero = { height: "image", verticalAlign };
    if (!sized) {
      notes.push(
        `${label} fluid-height has no background-width / background-height, so its image size is unknown; it renders as a regular section until it has a size or a fixed height.`,
      );
    }
  } else {
    if (mode !== "fixed-height") {
      notes.push(
        `${label} mode "${rawMode}" has no Templatical equivalent; imported as "fixed-height".`,
      );
    }
    const fixed = parsePx(value("height"));
    if (fixed !== undefined && fixed > 0) {
      hero = { height: Math.round(fixed), verticalAlign };
    }
  }

  if (hero && !image) {
    notes.push(
      `${label} has no background-url, so it renders as a regular section until it has a background image.`,
    );
  }

  for (const name of HERO_DROPPED_ATTRIBUTES) {
    const raw = value(name);
    if (raw === undefined) continue;
    notes.push(
      `${label} ${name} "${raw}" has no Templatical equivalent; dropped.`,
    );
  }

  return { hero, image, notes };
}
