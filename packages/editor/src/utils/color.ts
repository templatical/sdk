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

/**
 * Canonicalize a hex color to the lowercase 6-digit form used for preset
 * membership tests. Runs {@link normalizeColorToHex} first (so a
 * browser-serialized `rgb(...)` round-trip collapses to hex), then expands a
 * 3-digit shorthand (`#abc` → `#aabbcc`) and lowercases it. Non-hex input (a
 * keyword, or empty) is returned unchanged after that rgb normalization —
 * the caller decides whether that counts as a member.
 *
 * Kept separate from `normalizeColorToHex` (which is left untouched) because a
 * configured preset may be `#abc` while the browser round-trips the selected
 * value to `#aabbcc`, and a factory default may be `#FFFFFF` while the preset
 * is `#ffffff` — bare equality misses both. Preset-selection display
 * (`ColorPicker`) and the off-palette defaults audit (`collectOffPaletteDefaults`)
 * both compare through this one function so the two membership tests can't drift.
 */
export function canonicalizeHexColor(value: string): string {
  const hex = normalizeColorToHex(value);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return hex.toLowerCase();
  }
  return hex;
}
