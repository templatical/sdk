import type en from "./locales/en";

export type MediaTranslations = typeof en;

const supportedLocales = ["en", "de"];

function getBaseLocale(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

export async function loadMediaTranslations(
  locale: string,
): Promise<MediaTranslations> {
  const baseLocale = getBaseLocale(locale);
  const targetLocale = supportedLocales.includes(baseLocale)
    ? baseLocale
    : "en";

  const module = await import(`./locales/${targetLocale}.ts`);
  return module.default as MediaTranslations;
}
