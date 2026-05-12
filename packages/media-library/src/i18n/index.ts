import type en from "./locales/en";

export type MediaTranslations = typeof en;

const supportedLocales = ["en", "de", "pt-BR"] as const;
type SupportedLocale = (typeof supportedLocales)[number];

function canonicalize(locale: string): string {
  return locale.trim().replace(/_/g, "-").toLowerCase();
}

function findSupportedLocale(locale: string): SupportedLocale | undefined {
  const canonical = canonicalize(locale);
  return supportedLocales.find((s) => canonicalize(s) === canonical);
}

function getBaseLocale(locale: string): string {
  return canonicalize(locale).split("-")[0];
}

function resolveLocale(locale: string): SupportedLocale {
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
  const module = (await import(`./locales/${target}.ts`)) as {
    default: MediaTranslations;
  };
  return module.default;
}
