import type {
  BackgroundImage,
  BackgroundPositionX,
  BackgroundPositionY,
  BackgroundSize,
  SpacingValue,
} from "@templatical/types";

/**
 * Parses a CSS `style="..."` attribute string into a flat key/value record.
 * Keys are lowercased; values are trimmed. Quotes around values are not
 * stripped. A semicolon inside quotes or parentheses — `url("a;b")`,
 * `url(data:image/png;base64,…)` — belongs to its value.
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
export function splitTopLevel(value: string, separator: string): string[] {
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

/**
 * Serializes a flat key/value record back to a `style` attribute string.
 */
export function serializeStyleAttribute(
  styles: Record<string, string>,
): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

/**
 * Parses a px-like CSS value (`"12px"`, `"12"`, `12`) into a rounded integer.
 * Returns 0 for missing or unparseable input. Ignores em/% units.
 */
export function parsePxValue(value: string | number | undefined): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/);
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

/**
 * Parses a width value that may be a percentage. Returns the numeric percent
 * (0-100). For non-percent values, returns 100.
 */
export function parseWidthPercent(value: string | undefined): number {
  if (!value) return 100;
  const match = value.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (match) return Math.round(parseFloat(match[1]));
  return 100;
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
 * Normalizes a CSS color value to a 6-digit lowercase hex string.
 * - 3-digit hex expands to 6-digit
 * - rgb()/rgba() converts to hex (alpha is dropped)
 * - Named colors map via lookup
 * - "transparent" / unknown returns ""
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
 * Normalizes a legacy `bgcolor` attribute value the way `parseColor` does a
 * CSS one, also accepting hex without its `#` (`bgcolor="f4f4f4"`), which
 * browsers render and CSS rejects.
 */
export function parseLegacyColor(value: string | undefined): string {
  const color = parseColor(value);
  if (color) return color;
  const bare = (value ?? "").trim();
  return /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(bare)
    ? parseColor(`#${bare}`)
    : "";
}

/**
 * Parses a CSS `padding` shorthand (1-4 values) into a SpacingValue.
 */
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

/**
 * Reads CSS padding from a style record, preferring the longhand props
 * (padding-top/right/bottom/left) and falling back to the `padding` shorthand.
 */
export function readPaddingFromStyles(
  styles: Record<string, string>,
): SpacingValue {
  const shorthand = parsePaddingShorthand(styles.padding);
  return {
    top: parsePxValue(styles["padding-top"]) || shorthand.top,
    right: parsePxValue(styles["padding-right"]) || shorthand.right,
    bottom: parsePxValue(styles["padding-bottom"]) || shorthand.bottom,
    left: parsePxValue(styles["padding-left"]) || shorthand.left,
  };
}

/**
 * Normalizes a font-weight value to a string CSS keyword/number that
 * the editor accepts. Returns "" when the value is the default (normal/400).
 */
export function parseFontWeight(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "normal" || trimmed === "400") return "";
  return trimmed;
}

/**
 * Parses CSS text-align to one of the allowed editor alignments.
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
 * Parses a CSS `border` shorthand (`"1px solid #ccc"`) into width/style/color.
 * Order-tolerant: each token is classified by content.
 */
export function parseBorderShorthand(value: string | undefined): {
  width: number;
  style: string;
  color: string;
} {
  const fallback = { width: 0, style: "solid", color: "#000000" };
  if (!value) return fallback;

  const styleKeywords = new Set([
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

  let width = 0;
  let style = "solid";
  let color = "#000000";

  for (const token of value.trim().split(/\s+/)) {
    const lower = token.toLowerCase();
    if (styleKeywords.has(lower)) {
      style = lower;
    } else if (/^-?\d+(?:\.\d+)?(?:px)?$/i.test(lower)) {
      width = parsePxValue(lower);
    } else {
      const c = parseColor(lower);
      if (c) color = c;
    }
  }

  return { width, style, color };
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

/** CSS's initial values: what a browser paints for a longhand the source leaves out. */
const CSS_BACKGROUND_DEFAULTS = {
  size: "auto",
  x: "left",
  y: "top",
  repeat: true,
} as const;

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
const MEASURE = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-z]+)?$/i;

/**
 * The URL inside the first CSS `url(…)`, unquoted and trimmed; "" when there
 * is none or it is malformed. A forward scan rather than a regex, so a long
 * run of unclosed `url(` can't make it backtrack.
 */
function cssUrl(value: string | undefined): string {
  const text = value ?? "";
  const start = text.search(/url\(/i);
  if (start === -1) return "";
  let i = start + 4;
  while (i < text.length && /\s/.test(text[i])) i++;
  const quote = text[i];
  if (quote === '"' || quote === "'") {
    const close = text.indexOf(quote, i + 1);
    if (close === -1) return "";
    let j = close + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    return text[j] === ")" ? text.slice(i + 1, close).trim() : "";
  }
  const close = text.indexOf(")", i);
  if (close === -1) return "";
  const inner = text.slice(i, close);
  return /["']/.test(inner) ? "" : inner.trim();
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
 * The colour a `background` shorthand paints, as written (`parseColor` it);
 * "" when it states none. `background: #222 url(x) …` paints `#222`.
 */
export function backgroundShorthandColor(value: string | undefined): string {
  return value ? parseBackgroundShorthand(value).color : "";
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
  let lossyX = false;
  let lossyY = false;
  const rawPosition = longhands.position?.trim();
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
  const rawX = longhands.positionX?.trim();
  const overrideX = rawX
    ? backgroundAxisPoint(rawX.toLowerCase(), X_GRID)
    : null;
  if (overrideX) {
    x = overrideX.point;
    lossyX = false;
  }
  const rawY = longhands.positionY?.trim();
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
 * The legacy `background="…"` attribute of a table, cell or body: a URL
 * alone, tiled from the top left at the image's own size, as a browser
 * draws it.
 */
export function readLegacyBackground(
  value: string | undefined,
  label: string,
  boxWidth: number | undefined,
): ReadBackgroundImage | null {
  return buildBackgroundImage(value ?? "", {}, label, boxWidth);
}
