import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  BorderRadiusValue,
  BorderSideValue,
  SpacingValue,
} from "@templatical/types";

/**
 * Parses a px-like MJML attribute value (`"12px"`, `"12"`, `12`) into a rounded
 * integer. Returns 0 for missing or unparseable input, and for units the block
 * model cannot express (em, rem, %) — a caller that needs to tell "absent" from
 * "0" must check the raw attribute itself.
 */
export function parsePxValue(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/);
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
 * Normalizes a colour value to a 6-digit lowercase hex string.
 *
 * Returns `""` for transparent/inherit/none and for anything unrecognised.
 * The empty string is the block model's "unset" — the colour pickers clear to
 * it — so returning it is meaningfully different from returning a default.
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
 * Parses an MJML `padding` shorthand (1-4 values, CSS order) into a
 * SpacingValue.
 */
export function parsePaddingShorthand(value: string | undefined): SpacingValue {
  if (!value) return { top: 0, right: 0, bottom: 0, left: 0 };

  const values = value
    .trim()
    .split(/\s+/)
    .map((p) => parsePxValue(p));

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
 * Parses an alignment to one of the three the block model accepts.
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
 * Reads a percentage value, or `null` when the value is not a percentage.
 *
 * `null` rather than a number, because column-width matching (§8.1) has to tell
 * "no percentage given" from "0%" — the former distributes widths equally, the
 * latter is a real (if degenerate) width.
 */
export function parsePercent(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Reads a definite px length, or `null` when the value is not one.
 *
 * Unlike `parsePxValue`, which returns `0` for anything unparseable, this
 * tells "no length given" apart from "0px" — column-width recovery (§8.1)
 * needs that distinction for a px `mj-column` width the same way it needs
 * `parsePercent`'s `null` for a percentage one, so the two compose into a
 * single known-or-absent value the matcher can fill around.
 */
export function parseDefinitePx(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?$/);
  return match ? parseFloat(match[1]) : null;
}

const PX_LENGTH = /^(\d+(?:\.\d+)?)(?:px)?$/i;

/**
 * Reads a `border-radius` value: one px length, or the two- to four-value
 * shorthand (top-left, top-right, bottom-right, bottom-left), expanded the way
 * CSS expands it. Four matching corners come back as one number, the form the
 * renderer writes them in. `null` when any part is not a non-negative px
 * length (`50%`, `1em`, an elliptical `8px / 4px`), which CSS either reads
 * against the box or discards.
 */
export function parseBorderRadius(value: string): BorderRadiusValue | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length > 4) return null;

  const px: number[] = [];
  for (const part of parts) {
    const match = PX_LENGTH.exec(part);
    if (!match) return null;
    px.push(Math.round(parseFloat(match[1])));
  }

  const [
    topLeft,
    topRight = topLeft,
    bottomRight = topLeft,
    bottomLeft = topRight,
  ] = px;
  if (
    topRight === topLeft &&
    bottomRight === topLeft &&
    bottomLeft === topLeft
  ) {
    return topLeft;
  }
  return { topLeft, topRight, bottomRight, bottomLeft };
}

const DRAWN_STYLES = new Set(["solid", "dashed", "dotted"]);
const NARROWED_STYLES = new Set([
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);
const UNDRAWN_STYLES = new Set(["none", "hidden"]);

/**
 * Splits a CSS value on whitespace outside parentheses, so `rgb(0, 0, 0)` stays
 * one token. A linear scan rather than a regex, which would backtrack on a long
 * run of spaces.
 */
function splitCssTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Reads one CSS `border` declaration, its width, style and colour in any
 * order, as a `BorderSideValue`.
 *
 * `side` is `null` when CSS draws nothing: style `none` or `hidden`, no style
 * at all (CSS's initial style is `none`), or a `0` width. A style the block
 * model lacks narrows to solid and is named in `narrowedFrom`. A missing or
 * unknown colour is `""`, which the renderer writes back as no colour, so CSS
 * draws `currentColor` both times.
 *
 * Returns `null` for a drawn border it cannot hold: a width that is not px
 * (`2em`, `thin`), no width at all (CSS draws `medium`), or a value with two
 * of any part.
 */
export function parseBorderDeclaration(
  value: string,
): { side: BorderSideValue | null; narrowedFrom?: string } | null {
  let width: number | undefined;
  let style: string | undefined;
  let color: string | undefined;

  for (const token of splitCssTokens(value.trim())) {
    const lower = token.toLowerCase();
    const px = PX_LENGTH.exec(lower);
    const isStyle =
      DRAWN_STYLES.has(lower) ||
      NARROWED_STYLES.has(lower) ||
      UNDRAWN_STYLES.has(lower);

    if (px) {
      if (width !== undefined) return null;
      width = Math.round(parseFloat(px[1]));
    } else if (isStyle) {
      if (style !== undefined) return null;
      style = lower;
    } else if (/^[-+.\d]/.test(lower) || /^(thin|medium|thick)$/.test(lower)) {
      return null;
    } else {
      if (color !== undefined) return null;
      color = token;
    }
  }

  if (style === undefined || UNDRAWN_STYLES.has(style) || width === 0) {
    return { side: null };
  }
  if (width === undefined) return null;

  const side: BorderSideValue = {
    width,
    style: NARROWED_STYLES.has(style)
      ? "solid"
      : (style as BorderSideValue["style"]),
    color: parseColor(color),
  };
  return NARROWED_STYLES.has(style) ? { side, narrowedFrom: style } : { side };
}

/**
 * Narrows a border style to the three `DividerBlock.lineStyle` accepts.
 */
export function parseBorderStyle(
  value: string | undefined,
): "solid" | "dashed" | "dotted" {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "dashed" || v === "dotted") return v;
  return "solid";
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
