import type en from "./locales/en";

type DeepStringify<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? { [K in keyof T]: DeepStringify<T[K]> }
    : T;

export type Translations = DeepStringify<typeof en>;
export type TranslationKey = keyof Translations;
export type SupportedLocale = "en" | "de" | "pt-BR";
export const supportedLocales: SupportedLocale[] = ["en", "de", "pt-BR"];

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

function findSupportedLocale(locale: string): SupportedLocale | null {
  const normalized = normalizeLocale(locale);
  const exactMatch = supportedLocales.find(
    (supportedLocale) => normalizeLocale(supportedLocale) === normalized,
  );
  return exactMatch ?? null;
}

function resolveSupportedLocale(locale: string): SupportedLocale {
  const normalized = locale.trim();
  const exactSupported = findSupportedLocale(normalized);
  if (exactSupported) {
    return exactSupported;
  }

  const baseLocale = getBaseLocale(normalized);
  const baseSupported = findSupportedLocale(baseLocale);
  if (baseSupported) {
    return baseSupported;
  }

  return "en";
}

/**
 * Get the base language code from a locale string.
 * e.g., 'en-GB' -> 'en', 'de-DE' -> 'de'
 */
export function getBaseLocale(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

/**
 * Load translations for a given locale.
 * Falls back to English if the locale is not supported.
 * Only loads the required locale file.
 */
export async function loadTranslations(locale: string): Promise<Translations> {
  const targetLocale = resolveSupportedLocale(locale);
  const module = await import(`./locales/${targetLocale}.ts`);
  return module.default as Translations;
}

/**
 * Check if a locale is supported.
 */
export function isLocaleSupported(locale: string): boolean {
  const normalized = locale.trim();
  return Boolean(
    findSupportedLocale(normalized) ||
    findSupportedLocale(getBaseLocale(normalized)),
  );
}

/**
 * Get list of supported locales.
 */
export function getSupportedLocales(): SupportedLocale[] {
  return [...supportedLocales];
}
