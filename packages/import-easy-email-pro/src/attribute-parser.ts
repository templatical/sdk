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
