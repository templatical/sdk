import { computed, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";
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

  watch(
    locale,
    (lang) => {
      document.documentElement.lang = lang;
    },
    { immediate: true },
  );

  return { locale, t };
}

export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(values[key] ?? `{${key}}`),
  );
}
