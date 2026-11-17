/**
 * A template language names itself, independently of the editor's UI locale.
 * It uses the language name alone unless another configured or template tag
 * shares that language, when it uses the full tag's name. A nonblank host
 * label takes precedence and is returned exactly as written.
 */
export function languageName(
  locale: string,
  options?: {
    siblings?: readonly string[];
    labels?: Readonly<Record<string, string>>;
  },
): string {
  const label = options?.labels;
  if (label && Object.hasOwn(label, locale)) {
    const value = label[locale];
    if (typeof value === "string" && value.trim()) return value;
  }
  try {
    const tag = new Intl.Locale(locale);
    const duplicate = options?.siblings?.some((sibling) => {
      try {
        const other = new Intl.Locale(sibling);
        return (
          other.toString() !== tag.toString() && other.language === tag.language
        );
      } catch {
        return false;
      }
    });
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(
      duplicate ? locale : tag.language,
    );
    if (name === undefined) return locale;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return locale;
  }
}
