/// <reference types="vite/client" />

import type en from "./locales/en";

export type Translations = typeof en;
export type TranslationKey = keyof Translations;

// Vite resolves these globs at build time. Adding a new locale file
// automatically registers it — no array to keep in sync.
const ossModules = import.meta.glob<{ default: Translations }>(
  "./locales/*.ts",
);

function localesFromGlob(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map((path) => path.match(/\/([^/]+)\.ts$/)?.[1])
    .filter((locale): locale is string => Boolean(locale));
}

const supportedLocales = localesFromGlob(ossModules);

function canonicalize(locale: string): string {
  return locale.trim().replace(/_/g, "-").toLowerCase();
}

function findSupportedLocale(
  locale: string,
  supported: string[],
): string | undefined {
  const canonical = canonicalize(locale);
  return supported.find((s) => canonicalize(s) === canonical);
}

/**
 * Get the base language code from a locale string.
 * e.g., 'en-GB' -> 'en', 'de_DE' -> 'de'
 */
export function getBaseLocale(locale: string): string {
  return canonicalize(locale).split("-")[0];
}

function tryResolveLocale(
  locale: string,
  supported: string[],
): string | undefined {
  return (
    findSupportedLocale(locale, supported) ??
    findSupportedLocale(getBaseLocale(locale), supported)
  );
}

function resolveLocale(locale: string, supported: string[]): string {
  return tryResolveLocale(locale, supported) ?? "en";
}

/**
 * Load OSS translations for a given locale.
 * Falls back to English if the locale is not supported.
 */
export async function loadTranslations(locale: string): Promise<Translations> {
  const target = resolveLocale(locale, supportedLocales);
  const loader = ossModules[`./locales/${target}.ts`];
  const mod = await loader();
  return mod.default;
}

/** Check if a locale has OSS translations (matched by exact locale, then base). */
export function isLocaleSupported(locale: string): boolean {
  return tryResolveLocale(locale, supportedLocales) !== undefined;
}

/** List of OSS-supported locales. */
export function getSupportedLocales(): string[] {
  return [...supportedLocales];
}
