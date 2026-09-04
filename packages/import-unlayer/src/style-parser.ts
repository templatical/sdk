import type { SpacingValue } from "@templatical/types";
import type { UnlayerBorder, UnlayerFontFamily } from "./types";

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

export function parseWidthPercent(value: string | undefined): number {
  if (!value) return 100;
  const match = value.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (match) return Math.round(parseFloat(match[1]));
  return 100;
}

export function parseFontFamily(
  value: UnlayerFontFamily | string | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") {
    return value.split(",")[0].trim().replace(/['"]/g, "");
  }
  if (value.value) return value.value.split(",")[0].trim().replace(/['"]/g, "");
  if (value.label) return value.label;
  return "";
}
