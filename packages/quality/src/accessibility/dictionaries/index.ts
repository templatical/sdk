import en from "./en";

export type Dictionary = typeof en;

/**
 * Auto-discovered locale registry. Drop a `dictionaries/<lang>.ts` file
 * and it's bundled automatically — same pattern as the editor's i18n
 * and the sibling `messages/` registry.
 *
 * Eager glob: synchronous, all locales bundled into the package. Tiny
 * (a few hundred bytes per locale) so the cost is negligible.
 */
const modules = import.meta.glob<{ default: Dictionary }>("./*.ts", {
  eager: true,
});

const DICTIONARIES: Record<string, Dictionary> = {};
for (const path in modules) {
  const match = /\.\/([^/]+)\.ts$/.exec(path);
  if (!match) continue;
  const locale = match[1];
  if (locale === "index") continue;
  DICTIONARIES[locale] = modules[path].default;
}

/**
 * Returns a dictionary that unions every registered locale. Vague phrases
 * are universally vague — a German-locale email with an English "Click here"
 * CTA, or an English email with a French "cliquez ici", is still a vague
 * CTA, so the rule must detect across languages regardless of editor locale.
 *
 * The `locale` argument is accepted for API symmetry and future use (e.g.
 * weighted matching) but currently doesn't change the returned set.
 */
export function getDictionary(_locale: string): Dictionary {
  return UNIONED_DICTIONARY;
}

function unionAll(pick: (d: Dictionary) => readonly string[]): string[] {
  const set = new Set<string>();
  for (const dict of Object.values(DICTIONARIES)) {
    for (const phrase of pick(dict)) set.add(phrase);
  }
  return Array.from(set);
}

const UNIONED_DICTIONARY: Dictionary = {
  vagueLinkText: unionAll((d) => d.vagueLinkText),
  vagueButtonLabels: unionAll((d) => d.vagueButtonLabels),
};

export const SUPPORTED_DICTIONARY_LOCALES = Object.keys(DICTIONARIES);

/**
 * Normalize text for dictionary matching: lowercase, collapse whitespace,
 * strip leading/trailing non-alphanumeric characters (punctuation, arrows,
 * emoji, decorative symbols). "Click here!", "→ click here", "click here?"
 * all collapse to "click here" so the dictionary's plain phrase matches.
 */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}
