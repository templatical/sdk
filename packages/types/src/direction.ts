/**
 * Writing direction of the delivered email — the canvas `dir` and the
 * rendered `<mjml dir>`. Independent of the editor chrome language
 * (`init({ locale })`).
 */
export type ContentDirection = "ltr" | "rtl";

/**
 * Primary BCP-47 subtags whose default writing direction is right-to-left.
 * Region tags (`ar-SA`) resolve through the primary subtag. `"iw"` is the
 * legacy Hebrew tag. Not a CLDR dump — extend the list when a script is
 * needed; do not infer from `lang` at the call site.
 */
export const RTL_LANGUAGE_PRIMARY_SUBTAGS: readonly string[] = [
  "ar",
  "he",
  "iw",
  "fa",
  "ur",
  "yi",
  "dv",
  "ps",
  "sd",
  "ug",
  "ckb",
  "ks",
];

/**
 * Whether a BCP-47 (or underscore-separated) language tag is an RTL language
 * by primary subtag. Missing, empty, and unknown tags are not RTL.
 */
export function isRtlLanguageTag(tag: string | undefined): boolean {
  const primary = tag?.trim().replace(/_/g, "-").split("-")[0]?.toLowerCase();
  return !!primary && RTL_LANGUAGE_PRIMARY_SUBTAGS.includes(primary);
}

/**
 * The email's writing direction. An explicit `settings.direction` of `"ltr"`
 * or `"rtl"` wins; anything else (unset, or a garbage JS value) falls through
 * to the content language, then to `"ltr"`.
 *
 * This is the single reader — renderer, canvas, and settings UI all go
 * through it, so a later per-block override can wrap it without forking the
 * locale table.
 */
export function resolveContentDirection(settings: {
  locale: string;
  direction?: ContentDirection;
}): ContentDirection {
  if (settings.direction === "ltr" || settings.direction === "rtl") {
    return settings.direction;
  }
  return isRtlLanguageTag(settings.locale) ? "rtl" : "ltr";
}
