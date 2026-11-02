export type PluralString = { one: string; other: string };

/** Selects `one` or `other`, falling back to English for a malformed UI locale. */
export function plural(
  entry: PluralString,
  count: number,
  uiLocale: string,
  params?: Record<string, string | number>,
): string {
  let rules: Intl.PluralRules;
  try {
    rules = new Intl.PluralRules(uiLocale);
  } catch {
    rules = new Intl.PluralRules("en");
  }
  const template = rules.select(count) === "one" ? entry.one : entry.other;
  const values = { ...params, count };
  return template.replace(/\{(\w+)\}/g, (placeholder, key) =>
    key in values ? String(values[key as keyof typeof values]) : placeholder,
  );
}
