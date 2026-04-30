import type en from "./locales/en";

export type MediaTranslations = typeof en;

const supportedLocales = ["en", "de", "pt-BR"] as const;
type SupportedLocale = (typeof supportedLocales)[number];

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

function getBaseLocale(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

export async function loadMediaTranslations(
  locale: string,
): Promise<MediaTranslations> {
  const normalized = locale.trim();
  const exactSupported = findSupportedLocale(normalized);
  const baseSupported = findSupportedLocale(getBaseLocale(normalized));
  const targetLocale = exactSupported ?? baseSupported ?? "en";

  const module = await import(`./locales/${targetLocale}.ts`);
  return module.default as MediaTranslations;
}
