import { firstFontFamily, parseFontFamilies } from "@templatical/types";
import type { FontOption } from "../composables/useFonts";

/**
 * The value a font select binds: "" (its placeholder) for no font. TipTap
 * keeps raw inline values, so anything a browser would drop (blank, a CSS-wide
 * keyword, an invalid list) counts as no font.
 */
export function fontSelectValue(value: string | undefined): string {
  return value && parseFontFamilies(value).length > 0 ? value : "";
}

/**
 * The font options with `current` in them, so a font select shows the font in
 * use instead of going blank. A stack whose first family is offered takes over
 * that option ("Georgia, serif" selects "Georgia"); any other font is listed
 * first, labelled by its first family.
 */
export function withCurrentFont(
  fonts: FontOption[],
  current: string | undefined,
): FontOption[] {
  const value = fontSelectValue(current);
  if (value === "" || fonts.some((font) => font.value === value)) {
    return fonts;
  }
  const firstFamily = firstFontFamily(value);
  const family = firstFamily.toLowerCase();
  const matchIndex = fonts.findIndex(
    (font) =>
      font.label.toLowerCase() === family ||
      font.value.toLowerCase() === family,
  );
  if (matchIndex !== -1) {
    return fonts.map((font, index) =>
      index === matchIndex ? { ...font, value } : font,
    );
  }
  return [{ value, label: firstFamily }, ...fonts];
}
