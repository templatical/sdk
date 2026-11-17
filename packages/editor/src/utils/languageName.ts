/**
 * A template language's own name, never its region or script: `en-GB` and
 * `en-US` both read "English", `de-DE` reads "Deutsch". The name is in the
 * language itself, independently of the editor's UI locale. A tag that
 * `Intl` rejects comes back unchanged.
 */
export function languageName(locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(
      new Intl.Locale(locale).language,
    );
    if (name === undefined) return locale;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return locale;
  }
}
