/**
 * Tiny CSS readers for paint, padding and divider width.
 * Hex (3/6), a bare bgcolor hex, and rgb()/rgba() (alpha dropped).
 * "transparent" is unset. A present padding longhand of 0 beats the shorthand.
 */

import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  DividerBlock,
  SpacingValue,
} from "@templatical/types";

const ZERO: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };

/** Column shares of the body width. The third column takes the rounding remainder. */
const COLUMN_SHARES = {
  "1": [100],
  "2": [50, 50],
  "3": [33.33, 33.33, 33.34],
} as const;

const DIVIDER_WIDTH = /^(-?\d+(?:\.\d+)?)\s*(%|px)?$/i;

const SIDE_LETTER: Record<string, keyof SpacingValue> = {
  t: "top",
  r: "right",
  b: "bottom",
  l: "left",
};

/**
 * A `style` attribute as a key/value map. A semicolon inside quotes or
 * parentheses — `url("a;b")`, `url(data:image/png;base64,…)` — belongs to
 * its value.
 */
export function parseStyleAttribute(
  styleAttr: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleAttr) return result;
  for (const decl of splitTopLevel(styleAttr, ";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

/**
 * Split `value` at each `separator` that sits outside quotes and parentheses.
 * A value whose quote or parenthesis never closes is split at every
 * `separator` instead, so a malformed declaration costs only itself and the
 * ones after it still read.
 */
function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === separator && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  if (quote || depth > 0) return value.split(separator);
  parts.push(value.slice(start));
  return parts;
}

function channelHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0");
}

export function parseColor(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent" || trimmed === "inherit" || trimmed === "none")
    return "";
  const hex = trimmed.startsWith("#")
    ? trimmed
    : /^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(trimmed)
      ? `#${trimmed}`
      : "";
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  const rgb = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/,
  );
  if (rgb) {
    return `#${channelHex(Number(rgb[1]))}${channelHex(Number(rgb[2]))}${channelHex(Number(rgb[3]))}`;
  }
  return "";
}

export function parsePxValue(value: string | undefined): number {
  if (!value) return 0;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

/** Inline `background-color` / `background` wins over the `bgcolor` attribute. */
export function colorFromPaint(
  styleAttr: string | undefined,
  bgcolor?: string,
): string {
  const styles = parseStyleAttribute(styleAttr);
  const fromShorthand = styles.background
    ? parseColor(styles.background.trim().split(/\s+/)[0])
    : "";
  return (
    parseColor(styles["background-color"]) ||
    fromShorthand ||
    parseColor(bgcolor) ||
    ""
  );
}

export function parsePaddingShorthand(value: string | undefined): SpacingValue {
  if (!value) return { ...ZERO };
  const values = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => parsePxValue(part));
  if (values.length === 0) return { ...ZERO };
  if (values.length === 1) {
    return {
      top: values[0],
      right: values[0],
      bottom: values[0],
      left: values[0],
    };
  }
  if (values.length === 2) {
    return {
      top: values[0],
      right: values[1],
      bottom: values[0],
      left: values[1],
    };
  }
  if (values.length === 3) {
    return {
      top: values[0],
      right: values[1],
      bottom: values[2],
      left: values[1],
    };
  }
  return {
    top: values[0],
    right: values[1],
    bottom: values[2],
    left: values[3],
  };
}

/**
 * Longhand wins when it is present, including an explicit 0.
 * A missing longhand falls back to the shorthand, then 0.
 */
export function readPadding(styles: Record<string, string>): SpacingValue {
  const shorthand =
    styles.padding !== undefined ? parsePaddingShorthand(styles.padding) : ZERO;
  const side = (name: keyof SpacingValue): number => {
    const key = `padding-${name}`;
    if (styles[key] !== undefined) return parsePxValue(styles[key]);
    return shorthand[name];
  };
  return {
    top: side("top"),
    right: side("right"),
    bottom: side("bottom"),
    left: side("left"),
  };
}

/** `es-p20` sets every side; `es-p10t` / `r` / `b` / `l` then override one side. */
export function paddingFromClasses(
  classAttr: string | undefined,
): SpacingValue {
  const pad: SpacingValue = { ...ZERO };
  const tokens = (classAttr ?? "").split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const all = /^es-p(\d+)$/.exec(token);
    if (!all) continue;
    const n = Number(all[1]);
    pad.top = n;
    pad.right = n;
    pad.bottom = n;
    pad.left = n;
  }
  for (const token of tokens) {
    const side = /^es-p(\d+)([trbl])$/.exec(token);
    if (!side) continue;
    pad[SIDE_LETTER[side[2]]] = Number(side[1]);
  }
  return pad;
}

/**
 * Class padding first, then inline padding per side.
 * A shorthand replaces every side; a longhand replaces only that side.
 */
export function readBoxPadding(
  classAttr: string | undefined,
  styleAttr: string | undefined,
): SpacingValue {
  const base = paddingFromClasses(classAttr);
  const styles = parseStyleAttribute(styleAttr);
  const hasShorthand = styles.padding !== undefined;
  const shorthand = hasShorthand ? parsePaddingShorthand(styles.padding) : base;
  const side = (name: keyof SpacingValue): number => {
    const key = `padding-${name}`;
    if (styles[key] !== undefined) return parsePxValue(styles[key]);
    if (hasShorthand) return shorthand[name];
    return base[name];
  };
  return {
    top: side("top"),
    right: side("right"),
    bottom: side("bottom"),
    left: side("left"),
  };
}

export interface SectionPaint {
  backgroundColor: string;
  wrapperColor?: string;
  notes: string[];
}

/**
 * Body fill paints the section. A band that is neither the page nor the body
 * becomes the section wrapper. A transparent body leaves the band on the section.
 */
export function resolveSectionPaint(
  pageBackground: string,
  band: string,
  body: string,
): SectionPaint {
  const page = pageBackground || "#ffffff";
  if (body) {
    if (band && band !== page && band !== body) {
      return {
        backgroundColor: body,
        wrapperColor: band,
        notes: ["The band colour was imported as a section wrapper."],
      };
    }
    return { backgroundColor: body, notes: [] };
  }
  return { backgroundColor: band, notes: [] };
}

/** `es-*-body` width in px, or 600 when the document does not state one. */
export function emailBodyWidth(
  widthAttr: string | undefined,
  styleAttr: string | undefined,
): number {
  const raw = (widthAttr || parseStyleAttribute(styleAttr).width || "").trim();
  const n = parsePxValue(raw);
  return n > 0 ? n : 600;
}

/**
 * Room each column has for a line, before the line's own side padding.
 * The share is of the body width; the first column then loses the section's
 * left padding and the last loses the right. One column loses both.
 * A room that is not positive is unknown — the caller keeps the stated px.
 */
export function columnRooms(
  bodyWidth: number,
  layout: "1" | "2" | "3",
  padding: SpacingValue,
  slotCount: number,
): Array<number | undefined> {
  const shares = COLUMN_SHARES[layout];
  const count = layout === "1" ? 1 : slotCount;
  const width = bodyWidth > 0 ? bodyWidth : 600;
  return Array.from({ length: count }, (_, index) => {
    const span = layout === "1" ? width : (width * shares[index]) / 100;
    const left = layout === "1" || index === 0 ? padding.left : 0;
    const right = layout === "1" || index === count - 1 ? padding.right : 0;
    const room = span - left - right;
    return room > 0 ? room : undefined;
  });
}

/**
 * No width, `auto` and `100%` span the column. Another percentage stays a
 * share, clamped to 0–100 and rounded to two decimals. A px width stays px
 * until it reaches `room` less the divider's own side padding.
 */
export function readDividerWidth(
  raw: string,
  room: number | undefined,
  ownLeft: number,
  ownRight: number,
  notes: string[],
): DividerBlock["width"] {
  const trimmed = raw.trim();
  if (
    trimmed === "" ||
    trimmed.toLowerCase() === "auto" ||
    trimmed === "100%"
  ) {
    return "full";
  }
  const match = trimmed.match(DIVIDER_WIDTH);
  if (!match) {
    notes.push(
      `Divider width "${trimmed}" could not be read; imported as full width.`,
    );
    return "full";
  }
  const value = parseFloat(match[1]);
  if ((match[2] ?? "").toLowerCase() === "%") {
    const percent = Math.min(100, Math.max(0, value));
    if (percent !== value) {
      notes.push(`Divider width ${trimmed} was clamped to ${percent}%.`);
    }
    const share = Math.round((percent + Number.EPSILON) * 100) / 100;
    return share === 100 ? "full" : `${share}%`;
  }
  const px = Math.max(0, Math.round(value));
  if (value < 0) notes.push(`Divider width ${trimmed} was clamped to 0px.`);
  if (room === undefined || room <= 0) return px;
  return px >= room - ownLeft - ownRight ? "full" : px;
}

const BORDER_STYLES = new Set([
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

export interface ParsedBorder {
  width: number;
  style: string;
  color: string;
}

/** A `border-bottom` / `border-top` shorthand. Color is empty when absent. */
export function parseBorderShorthand(value: string | undefined): ParsedBorder {
  const parsed: ParsedBorder = { width: 0, style: "solid", color: "" };
  if (!value) return parsed;
  for (const token of value.trim().split(/\s+/)) {
    const lower = token.toLowerCase();
    if (BORDER_STYLES.has(lower)) {
      parsed.style = lower;
    } else if (/^-?\d+(?:\.\d+)?(?:px)?$/i.test(lower)) {
      parsed.width = parsePxValue(lower);
    } else {
      const color = parseColor(lower);
      if (color) parsed.color = color;
    }
  }
  return parsed;
}

export function visibleLineBorder(
  styles: Record<string, string>,
): ParsedBorder | null {
  for (const key of ["border-bottom", "border-top"]) {
    if (styles[key] === undefined) continue;
    const parsed = parseBorderShorthand(styles[key]);
    if (
      parsed.width > 0 &&
      parsed.style !== "none" &&
      parsed.style !== "hidden"
    ) {
      return parsed;
    }
  }
  return null;
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

/** CSS's initial values: what a browser paints for a longhand the source leaves out. */
const CSS_BACKGROUND_DEFAULTS = {
  size: "auto",
  x: "left",
  y: "top",
  repeat: true,
} as const;

const URL_FUNCTION = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']*))\s*\)/i;
const IMAGE_FUNCTION = /^(?:url|[a-z-]*gradient|image-set)\(/;
const REPEAT_TOKENS = new Set([
  "repeat",
  "no-repeat",
  "repeat-x",
  "repeat-y",
  "round",
  "space",
]);
const POSITION_TOKENS = new Set(["left", "right", "top", "bottom", "center"]);
const NON_COLOR_TOKENS = new Set([
  "none",
  "scroll",
  "fixed",
  "local",
  "border-box",
  "padding-box",
  "content-box",
  "text",
  "cover",
  "contain",
  "auto",
]);
const MEASURE = /^-?\d*\.?\d+(?:%|[a-z]+)?$/i;

/** The URL inside a CSS `url(…)`, unquoted and trimmed; "" when there is none. */
function cssUrl(value: string | undefined): string {
  const match = URL_FUNCTION.exec(value ?? "");
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

/**
 * Whitespace-separated tokens, keeping a function's arguments together and
 * making the `/` between position and size a token of its own.
 */
function cssTokens(value: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  const push = (): void => {
    if (current) tokens.push(current);
    current = "";
  };
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(char)) {
      push();
      continue;
    }
    if (depth === 0 && char === "/") {
      push();
      tokens.push("/");
      continue;
    }
    current += char;
  }
  push();
  return tokens;
}

function isColorToken(token: string): boolean {
  const lower = token.toLowerCase();
  if (lower === "/" || IMAGE_FUNCTION.test(lower)) return false;
  return (
    !REPEAT_TOKENS.has(lower) &&
    !POSITION_TOKENS.has(lower) &&
    !NON_COLOR_TOKENS.has(lower) &&
    !MEASURE.test(lower)
  );
}

export interface BackgroundShorthand {
  /** The colour token as written; "" when there is none. */
  color: string;
  url: string;
  size: string;
  position: string;
  repeat: string;
  layers: number;
}

/**
 * The parts of a `background` shorthand. The colour comes from the last
 * layer, the only one CSS lets carry it; the image and its size, position
 * and repeat come from the first layer with a `url()`.
 */
export function parseBackgroundShorthand(value: string): BackgroundShorthand {
  const layers = splitTopLevel(value, ",")
    .map((layer) => layer.trim())
    .filter(Boolean);
  const last = cssTokens(layers[layers.length - 1] ?? "");
  const color = last.find(isColorToken) ?? "";
  const imageLayer = layers.find((layer) => cssUrl(layer) !== "");
  if (!imageLayer) {
    return {
      color,
      url: "",
      size: "",
      position: "",
      repeat: "",
      layers: layers.length,
    };
  }

  const tokens = cssTokens(imageLayer);
  const slash = tokens.indexOf("/");
  const before = slash === -1 ? tokens : tokens.slice(0, slash);
  const after = slash === -1 ? [] : tokens.slice(slash + 1);
  const size: string[] = [];
  for (const token of after) {
    const lower = token.toLowerCase();
    const isSize =
      lower === "cover" ||
      lower === "contain" ||
      lower === "auto" ||
      MEASURE.test(lower);
    if (size.length === 2 || !isSize) break;
    size.push(token);
  }
  const rest = [...before, ...after.slice(size.length)];
  return {
    color,
    url: cssUrl(imageLayer),
    size: size.join(" "),
    position: before
      .filter(
        (token) =>
          POSITION_TOKENS.has(token.toLowerCase()) || MEASURE.test(token),
      )
      .join(" "),
    repeat: rest
      .filter((token) => REPEAT_TOKENS.has(token.toLowerCase()))
      .join(" "),
    layers: layers.length,
  };
}

/**
 * A background image from a URL and its longhands. A longhand left out takes
 * CSS's initial value; a value with no exact keyword takes the nearest one
 * and adds a note naming it. `null` for a blank URL.
 */
function buildBackgroundImage(
  url: string,
  longhands: {
    size?: string;
    position?: string;
    positionX?: string;
    positionY?: string;
    repeat?: string;
  },
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const notes: string[] = [];
  const lossy = (name: string, raw: string, shown: string): void => {
    notes.push(
      `${label} ${name} "${raw}" has no exact Templatical equivalent; imported as "${shown}".`,
    );
  };

  let size: BackgroundSize = CSS_BACKGROUND_DEFAULTS.size;
  const rawSize = longhands.size?.trim();
  if (rawSize) {
    const parsed = backgroundSizeKeyword(rawSize, boxWidth);
    size = parsed.size;
    if (!parsed.exact) lossy("background-size", rawSize, size);
  }

  let x: BackgroundPositionX = CSS_BACKGROUND_DEFAULTS.x;
  let y: BackgroundPositionY = CSS_BACKGROUND_DEFAULTS.y;
  const rawPosition = longhands.position?.trim();
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
  const rawX = longhands.positionX?.trim();
  if (rawX) {
    const parsed = backgroundAxisPoint(rawX.toLowerCase(), X_GRID);
    x = parsed?.point ?? x;
    if (!parsed?.exact) lossy("background-position-x", rawX, x);
  }
  const rawY = longhands.positionY?.trim();
  if (rawY) {
    const parsed = backgroundAxisPoint(rawY.toLowerCase(), Y_GRID);
    y = parsed?.point ?? y;
    if (!parsed?.exact) lossy("background-position-y", rawY, y);
  }

  let repeat: boolean = CSS_BACKGROUND_DEFAULTS.repeat;
  const rawRepeat = longhands.repeat?.trim();
  if (rawRepeat) {
    const parsed = backgroundRepeatFlag(rawRepeat);
    repeat = parsed.repeat;
    if (!parsed.exact) {
      lossy("background-repeat", rawRepeat, repeat ? "repeat" : "no-repeat");
    }
  }

  return {
    image: { url: trimmedUrl, size, position: { x, y }, repeat },
    notes,
  };
}

/**
 * A background image from CSS declarations: `background-image`, else the
 * `background` shorthand's image, with the size, position and repeat
 * longhands winning over the shorthand's. A style map keeps no declaration
 * order, so a longhand is taken to follow the shorthand, as it usually does.
 * Of several layers the first image is kept, and a note says so. `null`
 * when the declarations paint no image.
 */
export function readCssBackground(
  styles: Record<string, string>,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const shorthand =
    styles.background !== undefined
      ? parseBackgroundShorthand(styles.background)
      : null;
  const imageLayers =
    styles["background-image"] !== undefined
      ? splitTopLevel(styles["background-image"], ",").map((layer) =>
          layer.trim(),
        )
      : null;
  const index = imageLayers
    ? imageLayers.findIndex((layer) => cssUrl(layer) !== "")
    : -1;
  const url = imageLayers
    ? index === -1
      ? ""
      : cssUrl(imageLayers[index])
    : (shorthand?.url ?? "");
  if (!url) return null;

  const layer = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    const parts = splitTopLevel(value, ",").map((part) => part.trim());
    return parts[Math.max(index, 0)] ?? parts[0];
  };
  const read = buildBackgroundImage(
    url,
    {
      size: layer(styles["background-size"]) ?? shorthand?.size,
      position: layer(styles["background-position"]) ?? shorthand?.position,
      positionX: styles["background-position-x"],
      positionY: styles["background-position-y"],
      repeat: layer(styles["background-repeat"]) ?? shorthand?.repeat,
    },
    label,
    boxWidth,
  );
  const layers = imageLayers?.length ?? shorthand?.layers ?? 1;
  if (read && layers > 1) {
    read.notes.unshift(
      `${label} background has ${layers} layers; only the image "${url}" was imported.`,
    );
  }
  return read;
}

/**
 * The image an element paints: its inline CSS background, else its legacy
 * `background` attribute. A `background-image` or `background` declaration
 * overrides the attribute; a `background-color` doesn't. The image twin of
 * `colorFromPaint`.
 */
export function imageFromPaint(
  styleAttr: string | undefined,
  backgroundAttr: string | undefined,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  const styles = parseStyleAttribute(styleAttr);
  if (
    styles["background-image"] !== undefined ||
    styles.background !== undefined
  ) {
    return readCssBackground(styles, label, boxWidth);
  }
  return buildBackgroundImage(backgroundAttr ?? "", {}, label, boxWidth);
}

/** An image an element paints, and that element, which identifies the image when it spans several sections. */
export interface ImageLayer {
  read: ReadBackgroundImage;
  source: object;
}

/** Every image that can reach one section. */
export interface SectionImageLayers {
  /** The structure (row) cell's own image. */
  structure: ImageLayer | null;
  /** The `es-*-body` image: the content area behind every structure in the stripe. */
  body: ImageLayer | null;
  /** The stripe's image: the full-width band. */
  band: ImageLayer | null;
  /** Each container's image, in column order. */
  columns: Array<ReadBackgroundImage | null>;
  /** Whether the body paints a colour, which hides the band in the content area. */
  bodyPainted: boolean;
}

export interface SectionImage {
  image: BackgroundImage | undefined;
  notes: string[];
  /** The element the image came from when other sections can share it; `null` for a container's. */
  source: object | null;
}

function sameImage(a: BackgroundImage, b: BackgroundImage): boolean {
  return (
    a.url === b.url &&
    a.size === b.size &&
    a.repeat === b.repeat &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y
  );
}

function droppedColumnsNote(columns: number[]): string {
  return columns.length === 1
    ? `The background image on column ${columns[0]} was dropped. A Templatical section has one background image.`
    : `Background images on columns ${columns.join(", ")} were dropped. A Templatical section has one background image.`;
}

/**
 * The image a section paints, nearest first: the structure's own, then the
 * body's, then the containers', moved up when there is one or all share the
 * same image, then the stripe's while the body leaves it showing. An image
 * that showed in the section but can't be kept is named in a note. A body
 * image beneath the structure's own is covered in this section, so it isn't
 * named; it still paints the stripe's other sections. The image is a copy,
 * so sections that share a source don't share an object.
 */
export function resolveSectionImage(layers: SectionImageLayers): SectionImage {
  const notes: string[] = [];
  let picked: { read: ReadBackgroundImage; source: object | null } | null =
    layers.structure ?? layers.body;

  const withImage = layers.columns.flatMap((read, index) =>
    read ? [index + 1] : [],
  );
  const first = layers.columns[0] ?? null;
  const shared =
    first !== null &&
    layers.columns.every(
      (read) => read !== null && sameImage(read.image, first.image),
    );
  if (withImage.length > 0) {
    if (!picked && shared) picked = { read: first, source: null };
    else notes.push(droppedColumnsNote(withImage));
  }

  if (layers.band) {
    if (!picked && !layers.bodyPainted) {
      picked = layers.band;
      notes.push(
        "The stripe's background image spans the full width in Stripo; the section paints it at the content width.",
      );
    } else {
      notes.push(
        "The stripe's background image outside the content width was dropped.",
      );
    }
  }

  if (!picked) return { image: undefined, notes, source: null };
  return {
    image: {
      ...picked.read.image,
      position: { ...picked.read.image.position },
    },
    notes: [...picked.read.notes, ...notes],
    source: picked.source,
  };
}

/**
 * The paint, minus a band colour that would become the section's wrapper
 * colour, when the section has a background image. The wrapper has no
 * padding, so the colour shows nowhere except Outlook desktop, which paints
 * it over the section's image.
 */
export function withoutBandOverImage(
  paint: SectionPaint,
  hasImage: boolean,
): SectionPaint {
  if (!hasImage || !paint.wrapperColor) return paint;
  return {
    backgroundColor: paint.backgroundColor,
    notes: [
      `The band colour ${paint.wrapperColor} was dropped: Outlook desktop paints a wrapper colour over the section's background image.`,
    ],
  };
}
