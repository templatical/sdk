/**
 * An `@import` rule. The URL alternatives are quote-aware because a URL can
 * carry `;` (Google Fonts' `wght@400;500`), which would otherwise end the
 * match mid-URL and leave the rest of it behind in the CSS.
 */
const IMPORT_RULE =
  /@import\s*(?:url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)|"[^"]*"|'[^']*')[^;]*;/g;

/**
 * Removes every `@import` rule from CSS headed for a constructed stylesheet.
 * A constructed sheet cannot hold one: `replaceSync` drops it and logs a
 * warning on the host page.
 */
export function stripStylesheetImports(css: string): string {
  return css.replace(IMPORT_RULE, "");
}
