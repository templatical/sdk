/**
 * Tiny CSS readers for paint, padding and divider width.
 * Hex (3/6), a bare bgcolor hex, and rgb()/rgba() (alpha dropped).
 * "transparent" is unset. A present padding longhand of 0 beats the shorthand.
 */

import type { DividerBlock, SpacingValue } from "@templatical/types";

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

export function parseStyleAttribute(
  styleAttr: string | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleAttr) return result;
  for (const decl of styleAttr.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
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

export function hasBackgroundImage(styleAttr: string | undefined): boolean {
  if (!styleAttr) return false;
  const styles = parseStyleAttribute(styleAttr);
  return (
    /url\s*\(/i.test(styles["background-image"] ?? "") ||
    /url\s*\(/i.test(styles.background ?? "")
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
