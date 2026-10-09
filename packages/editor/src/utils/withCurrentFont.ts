import type { FontOption } from "../composables/useFonts";

/**
 * The font options with `current` listed first when none of them is it, so a
 * font select shows the font in use instead of going blank. Imported content
 * often carries a full stack ("Helvetica Neue, Helvetica, Arial, sans-serif")
 * where the options are single families. The extra option is labelled by its
 * first family, or in full when that would read the same as a listed font.
 */
export function withCurrentFont(
  fonts: FontOption[],
  current: string | undefined,
): FontOption[] {
  if (!current || fonts.some((font) => font.value === current)) {
    return fonts;
  }
  const firstFamily = current
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
  const label = fonts.some(
    (font) => font.label.toLowerCase() === firstFamily.toLowerCase(),
  )
    ? current
    : firstFamily;
  return [{ value: current, label }, ...fonts];
}
