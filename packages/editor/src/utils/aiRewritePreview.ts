/** The languages Translate offers (D22): BCP 47 tags the provider receives as they are. */
export const REWRITE_LANGUAGES = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "pt-BR",
  "pt-PT",
  "nl",
  "pl",
  "sv",
  "da",
  "fi",
  "nb",
  "cs",
  "ja",
  "zh-CN",
] as const;

/** The languages, named in the editor's locale; the tag where `Intl` can't name one. */
export function rewriteLanguageOptions(
  locale: string | undefined,
): { value: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(locale ? [locale.replace(/_/g, "-")] : [], {
      type: "language",
    });
  } catch {
    names = null;
  }
  return REWRITE_LANGUAGES.map((tag) => {
    let label: string | undefined;
    try {
      label = names?.of(tag);
    } catch {
      label = undefined;
    }
    return { value: tag, label: label ?? tag };
  });
}

/**
 * A rewrite still streaming in, as text: the HTML so far parsed into an inert
 * document and read back as its text, so unchecked model markup never reaches
 * the page (D22).
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  // Splitting on tags reads the text between them, as replace() would.
  if (typeof DOMParser === "undefined") return html.split(/<[^>]*>/).join("");
  const parsed = new DOMParser().parseFromString(
    `<!doctype html><body>${html}</body>`,
    "text/html",
  );
  return parsed.body.textContent ?? "";
}
