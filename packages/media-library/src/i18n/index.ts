/// <reference types="vite/client" />

import type en from "./locales/en";

export type MediaTranslations = typeof en;

// Vite resolves this glob at build time. Adding a new locale file
// automatically registers it — no array to keep in sync.
const localeModules = import.meta.glob<{ default: MediaTranslations }>(
  "./locales/*.ts",
);

function localesFromGlob(modules: Record<string, unknown>): string[] {
  return Object.keys(modules)
    .map((path) => path.match(/\/([^/]+)\.ts$/)?.[1])
    .filter((locale): locale is string => Boolean(locale));
}

const supportedLocales = localesFromGlob(localeModules);

function canonicalize(locale: string): string {
  return locale.trim().replace(/_/g, "-").toLowerCase();
}

function findSupportedLocale(locale: string): string | undefined {
  const canonical = canonicalize(locale);
  return supportedLocales.find((s) => canonicalize(s) === canonical);
}

function getBaseLocale(locale: string): string {
  return canonicalize(locale).split("-")[0];
}

function resolveLocale(locale: string): string {
  return (
    findSupportedLocale(locale) ??
    findSupportedLocale(getBaseLocale(locale)) ??
    "en"
  );
}

export async function loadMediaTranslations(
  locale: string,
): Promise<MediaTranslations> {
  const target = resolveLocale(locale);
  const loader = localeModules[`./locales/${target}.ts`];
  const module = await loader();
  return module.default;
}
