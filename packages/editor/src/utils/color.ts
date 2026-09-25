const RGB_CHANNELS =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+)\s*)?\)$/i;

function channelsToHex(r: string, g: string, b: string): string {
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Normalize an opaque `rgb()` / `rgba(..., 1)` to `#rrggbb`. The browser
 * serializes an inline `style="color:#hex"` to `rgb(...)`, so reading a stored
 * color back via `element.style.color` (e.g. a TipTap textStyle/highlight mark,
 * or a saved link color) surfaces `rgb(...)` — mismatching the hex used
 * everywhere else, and unparseable by the hex-only picker (`vanilla-colorful`).
 *
 * An `rgba()` whose alpha is anything other than 1 is returned unchanged: that
 * alpha is the stored color, and folding it to hex would drop it on the next
 * edit. Keywords (`transparent`), hex, and empty are returned unchanged.
 */
export function normalizeColorToHex(value: string): string {
  const m = RGB_CHANNELS.exec(value.trim());
  if (!m) return value;
  if (m[4] !== undefined && Number(m[4]) !== 1) return value.trim();
  return channelsToHex(m[1], m[2], m[3]);
}

/**
 * The `#rrggbb` of a color's RGB channels, ignoring alpha. Used to position
 * the hex wheel on a stored `rgba()` without writing that hex back. Returns
 * null for keywords and empty.
 */
export function opaqueHex(value: string): string | null {
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  const m = RGB_CHANNELS.exec(trimmed);
  if (!m) return null;
  return channelsToHex(m[1], m[2], m[3]);
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
