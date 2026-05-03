/// <reference types="vite/client" />

import type en from "./locales/en";
import type cloudEn from "./locales/cloud/en";

export type Translations = typeof en;
export type CloudTranslations = typeof cloudEn;
export type TranslationKey = keyof Translations;

// Vite resolves these globs at build time. Adding a new locale file
// automatically registers it — no array to keep in sync.
const ossModules = import.meta.glob<{ default: Translations }>(
  "./locales/*.ts",
);
const cloudModules = import.meta.glob<{ default: CloudTranslations }>(
  "./locales/cloud/*.ts",
);

function localesFromGlob(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map((path) => path.match(/\/([^/]+)\.ts$/)?.[1])
    .filter((locale): locale is string => Boolean(locale));
}

const supportedLocales = localesFromGlob(ossModules);
const supportedCloudLocales = localesFromGlob(cloudModules);

function normalizeLocale(locale: string): string {
  const parts = locale.trim().replace(/_/g, "-").split("-");
  const language = parts.shift()?.toLowerCase();

  if (!language) return "";

  return [
    language,
    ...parts.map((part) => (part.length === 2 ? part.toUpperCase() : part)),
  ].join("-");
}

function findSupportedLocale(
  locale: string,
  supported: string[],
): string | null {
  const normalized = normalizeLocale(locale).toLowerCase();
  return (
    supported.find(
      (supportedLocale) =>
        normalizeLocale(supportedLocale).toLowerCase() === normalized,
    ) ?? null
  );
}

/**
 * Get the base language code from a locale string.
 * e.g., 'en-GB' -> 'en', 'de-DE' -> 'de'
 */
export function getBaseLocale(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

function resolveLocale(locale: string, supported: string[]): string {
  const exact = findSupportedLocale(locale, supported);
  if (exact) return exact;

  const base = getBaseLocale(normalizeLocale(locale));
  return findSupportedLocale(base, supported) ?? "en";
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

/**
 * Load cloud translations for a given locale.
 * Cloud translations cover features available only via initCloud() —
 * AI, comments, collaboration, scoring, snapshots, plan limits, etc.
 * OSS contributors don't need to translate these; cloud locales fall back
 * to English independently of the OSS locale.
 */
export async function loadCloudTranslations(
  locale: string,
): Promise<CloudTranslations> {
  const target = resolveLocale(locale, supportedCloudLocales);
  const loader = cloudModules[`./locales/cloud/${target}.ts`];
  const mod = await loader();
  return mod.default;
}

/** Check if a locale has OSS translations (matched by exact locale, then base). */
export function isLocaleSupported(locale: string): boolean {
  return Boolean(
    findSupportedLocale(locale, supportedLocales) ||
    findSupportedLocale(
      getBaseLocale(normalizeLocale(locale)),
      supportedLocales,
    ),
  );
}

/** Check if a locale has cloud translations (matched by exact locale, then base). */
export function isCloudLocaleSupported(locale: string): boolean {
  return Boolean(
    findSupportedLocale(locale, supportedCloudLocales) ||
    findSupportedLocale(
      getBaseLocale(normalizeLocale(locale)),
      supportedCloudLocales,
    ),
  );
}

/** List of OSS-supported locales. */
export function getSupportedLocales(): string[] {
  return [...supportedLocales];
}

/** List of cloud-supported locales. May be a subset of OSS locales. */
export function getSupportedCloudLocales(): string[] {
  return [...supportedCloudLocales];
}
