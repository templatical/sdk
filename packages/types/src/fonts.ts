/**
 * Font-stack primitives shared by the renderer, the editor's canvas and font
 * selects, and every importer, so all of them read a CSS `font-family` value
 * the same way.
 *
 * A value is a comma-separated list of families, each either quoted
 * (`'Times New Roman'`, `"Helvetica Neue"`) or a run of identifiers
 * (`Helvetica Neue`, `sans-serif`). The split is a forward character scan, not
 * a regex: a quoted family may contain a comma (`"Foo, Bar"`), and an
 * unterminated quote must fail fast rather than backtrack.
 */

import type { CustomFont } from "./config";

export interface FontFamily {
  /** The family name, quotes removed and backslash escapes resolved. */
  name: string;
  /**
   * Whether the source quoted it. Quoting matters for generic keywords:
   * unquoted `serif` is the generic family, quoted `'serif'` names a font.
   */
  quoted: boolean;
}

/**
 * The built-in web-safe families, keyed by lowercased name, and the stack the
 * renderer emits for each.
 */
export const BUILT_IN_FONT_STACKS: Readonly<Record<string, string>> = {
  arial: "Arial, sans-serif",
  helvetica: "Helvetica, sans-serif",
  georgia: "Georgia, serif",
  "times new roman": "'Times New Roman', serif",
  verdana: "Verdana, sans-serif",
  "trebuchet ms": "'Trebuchet MS', sans-serif",
  "courier new": "'Courier New', monospace",
  tahoma: "Tahoma, sans-serif",
};

const CSS_WIDE_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
]);

function isSpace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

/**
 * The families in a `font-family` value, or `[]` when it sets no font. That
 * covers blank, a CSS-wide keyword, and any list a browser would reject (an
 * empty entry, a CSS-wide keyword among other families, an unterminated
 * quote), because a browser drops an invalid declaration and renders no font
 * from it. A trailing `!important` is ignored.
 */
export function parseFontFamilies(value: unknown): FontFamily[] {
  if (typeof value !== "string") return [];
  const text = value.replace(/!\s*important\s*$/i, "");
  const families: FontFamily[] = [];
  let i = 0;
  for (;;) {
    while (i < text.length && isSpace(text[i])) i++;
    if (i >= text.length) return [];
    const open = text[i];
    if (open === '"' || open === "'") {
      let name = "";
      let j = i + 1;
      let closed = false;
      while (j < text.length) {
        const char = text[j];
        if (char === "\\" && j + 1 < text.length) {
          name += text[j + 1];
          j += 2;
          continue;
        }
        if (char === open) {
          closed = true;
          j++;
          break;
        }
        name += char;
        j++;
      }
      if (!closed) return [];
      while (j < text.length && isSpace(text[j])) j++;
      if (j < text.length && text[j] !== ",") return [];
      families.push({ name, quoted: true });
      i = j;
    } else {
      const comma = text.indexOf(",", i);
      const end = comma === -1 ? text.length : comma;
      const name = text.slice(i, end).trim().split(/\s+/).join(" ");
      if (name === "") return [];
      if (name.includes('"') || name.includes("'")) return [];
      if (CSS_WIDE_KEYWORDS.has(name.toLowerCase())) return [];
      families.push({ name, quoted: false });
      i = end;
    }
    if (i >= text.length) return families;
    // Past the comma. A trailing comma leaves nothing, which returns [].
    i++;
  }
}

/** `name` as a single-quoted CSS string. */
export function quoteFontFamily(name: string): string {
  return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Families back into a `font-family` value, quoted ones in single quotes. */
export function formatFontFamilies(families: readonly FontFamily[]): string {
  return families
    .map((family) =>
      family.quoted ? quoteFontFamily(family.name) : family.name,
    )
    .join(", ");
}

/** An unquoted generic family keyword such as `sans-serif` or `system-ui`. */
export function isGenericFontFamily(family: FontFamily): boolean {
  return !family.quoted && GENERIC_FAMILIES.has(family.name.toLowerCase());
}

/**
 * `value` re-serialised: single-quoted names, `", "` separators, no
 * `!important`. `""` when it sets no font. Never contains `"`, so it can sit
 * inside a double-quoted `style` attribute.
 */
export function normalizeFontStack(value: unknown): string {
  return formatFontFamilies(parseFontFamilies(value));
}

/** The first family's name, unquoted; `""` when `value` sets no font. */
export function firstFontFamily(value: unknown): string {
  return parseFontFamilies(value)[0]?.name ?? "";
}

function sameFamilies(
  a: readonly FontFamily[],
  b: readonly FontFamily[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (family, index) =>
        family.name.toLowerCase() === b[index].name.toLowerCase() &&
        isGenericFontFamily(family) === isGenericFontFamily(b[index]),
    )
  );
}

/**
 * How an importer stores a font: `value` normalised, except that a built-in
 * stated alone, or as exactly the stack the renderer emits for it
 * (`Arial, sans-serif`), becomes the built-in's bare name. That collapse is
 * lossless under any render config, because the renderer re-expands a
 * built-in from its fixed table. Every other stack is kept, so its fallbacks
 * survive. `""` when `value` sets no font.
 */
export function canonicalFontStack(value: unknown): string {
  const families = parseFontFamilies(value);
  if (families.length === 0) return "";
  const builtInStack = BUILT_IN_FONT_STACKS[families[0].name.toLowerCase()];
  if (builtInStack) {
    const builtIn = parseFontFamilies(builtInStack);
    if (families.length === 1 || sameFamilies(families, builtIn)) {
      return builtIn[0].name;
    }
  }
  return formatFontFamilies(families);
}

/**
 * The `font-family` an email sets for a stored value, given the fonts the
 * template renders with. The renderer emits it, and the editor canvas applies
 * it, so a font previews with the same fallbacks the recipient gets.
 *
 * Only a lone family is resolved: a built-in expands to its stack, a custom
 * font is followed by its own fallback (or `defaultFallback`), and any other
 * named family by `defaultFallback`. A stack, a generic family, a CSS-wide
 * keyword or an invalid value is returned as written.
 *
 * A custom font also matches by its bare name, which is how the font picker
 * stores it, even when that name isn't valid CSS unquoted (`Ma'am Sans`).
 */
export function resolveFontStack(
  value: string,
  fonts: { customFonts: readonly CustomFont[]; defaultFallback: string },
): string {
  const withFallback = (font: CustomFont): string =>
    `${quoteFontFamily(font.name)}, ${font.fallback ?? fonts.defaultFallback}`;

  // `value` is typed, but untyped template JSON can omit it; like
  // `parseFontFamilies`, a non-string then passes through as written.
  const bareName = typeof value === "string" ? value.trim().toLowerCase() : "";
  const namedFont = fonts.customFonts.find(
    (font) => font.name.toLowerCase() === bareName,
  );
  if (namedFont) {
    return withFallback(namedFont);
  }

  const families = parseFontFamilies(value);
  if (families.length !== 1) {
    return value;
  }
  const [family] = families;
  const key = family.name.toLowerCase();

  const customFont = fonts.customFonts.find(
    (font) => font.name.toLowerCase() === key,
  );
  if (customFont) {
    return withFallback(customFont);
  }

  const builtIn = BUILT_IN_FONT_STACKS[key];
  if (builtIn) {
    return builtIn;
  }

  if (isGenericFontFamily(family)) {
    return value;
  }

  return `${quoteFontFamily(family.name)}, ${fonts.defaultFallback}`;
}
