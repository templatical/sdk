import { computed } from "vue";
import { useLocalStorage, useMediaQuery, watchImmediate } from "@vueuse/core";
import en from "./en";
import de from "./de";

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof en>;
export type SupportedLocale = "en" | "de";

const translations: Record<string, Translations> = { en, de };

export const supportedLocales: SupportedLocale[] = ["en", "de"];

export function usePlaygroundI18n() {
  const locale = useLocalStorage<SupportedLocale>(
    "tpl-playground-locale",
    "en",
  );
  const t = computed(() => translations[locale.value] ?? en);

  watchImmediate(locale, (lang) => {
    document.documentElement.lang = lang;
  });

  return { locale, t };
}

export type PlaygroundTheme = "auto" | "light" | "dark";

export function usePlaygroundTheme() {
  const theme = useLocalStorage<PlaygroundTheme>(
    "tpl-playground-theme",
    "auto",
  );
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const isDark = computed(() => {
    if (theme.value === "auto") return prefersDark.value;
    return theme.value === "dark";
  });

  watchImmediate(isDark, (dark) => {
    document.documentElement.classList.toggle("dark", dark);
  });

  return { theme, isDark };
}

export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(values[key] ?? `{${key}}`),
  );
}
