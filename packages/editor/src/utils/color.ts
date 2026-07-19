/**
 * Normalize a browser-serialized `rgb()/rgba()` color to `#rrggbb`. The browser
 * serializes an inline `style="color:#hex"` to `rgb(...)`, so reading a stored
 * color back via `element.style.color` (e.g. a TipTap textStyle/highlight mark,
 * or a saved link color) surfaces `rgb(...)` — mismatching the hex used
 * everywhere else, and unparseable by the hex-only picker (`vanilla-colorful`)
 * and the native `<input type="color">`. Non-rgb input (already hex, a keyword,
 * or empty) is returned unchanged.
 */
export function normalizeColorToHex(value: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value.trim());
  if (!m) return value;
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}
