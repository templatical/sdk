import type { SpacingValue } from "@templatical/types";

/**
 * Parses CSS-like style values from BeeFree descriptors.
 */

export function parsePxValue(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*px/);
  return match ? Math.round(parseFloat(match[1])) : 0;
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
