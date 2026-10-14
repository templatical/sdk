import type { FontOption } from "../composables/useFonts";

const CSS_WIDE_KEYWORDS = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
]);

function withoutImportant(value: string): string {
  return value.replace(/!\s*important\s*$/i, "").trim();
}

/**
 * The value a font select binds: "" (its placeholder) for no font. TipTap
 * keeps raw inline values, so a CSS-wide keyword or a blank value counts as
 * no font.
 */
export function fontSelectValue(value: string | undefined): string {
  if (!value) return "";
  const stack = withoutImportant(value);
  return stack === "" || CSS_WIDE_KEYWORDS.has(stack.toLowerCase())
    ? ""
    : value;
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
  const firstFamily = withoutImportant(value)
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
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
