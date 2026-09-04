import type { SpacingValue } from "@templatical/types";

/**
 * Parses CSS-like style values from BeeFree descriptors.
 */

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

export function parseColor(value: string | undefined): string {
  if (!value || value === "transparent") return "";

  const trimmed = value.trim();

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

export function parseWidthPercent(value: string | undefined): number {
  if (!value) return 100;
  const match = value.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (match) return Math.round(parseFloat(match[1]));
  // Might be px — return 100 as default
  return 100;
}

export function parseFontFamily(value: string | undefined): string {
  if (!value) return "";
  // Take the first font in the stack
  return value.split(",")[0].trim().replace(/['"]/g, "");
}
