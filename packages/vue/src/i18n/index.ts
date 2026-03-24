import type en from './locales/en';

export type Translations = typeof en;
export type TranslationKey = keyof Translations;

const supportedLocales = ['en', 'de'];

/**
 * Get the base language code from a locale string.
 * e.g., 'en-GB' -> 'en', 'de-DE' -> 'de'
 */
export function getBaseLocale(locale: string): string {
    return locale.split('-')[0].toLowerCase();
}

/**
 * Load translations for a given locale.
 * Falls back to English if the locale is not supported.
 * Only loads the required locale file.
 */
export async function loadTranslations(locale: string): Promise<Translations> {
    const baseLocale = getBaseLocale(locale);
    const targetLocale = supportedLocales.includes(baseLocale)
        ? baseLocale
        : 'en';

    const module = await import(`./locales/${targetLocale}.ts`);
    return module.default as Translations;
}

/**
 * Check if a locale is supported.
 */
export function isLocaleSupported(locale: string): boolean {
    return (
        supportedLocales.includes(locale) ||
        supportedLocales.includes(getBaseLocale(locale))
    );
}

/**
 * Get list of supported locales.
 */
export function getSupportedLocales(): string[] {
    return [...supportedLocales];
}
