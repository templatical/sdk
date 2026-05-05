import en from "./en";
import de from "./de";

export type Dictionary = typeof en;

const DICTIONARIES: Record<string, Dictionary> = {
  en,
  de,
};

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
