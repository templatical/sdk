import { inject, type Ref } from "vue";
import type { TemplateContent } from "@templatical/types";
import { EDITOR_KEY, LOCALIZATION_KEY } from "../keys";
import { languageName } from "../utils/languageName";

export function useLanguageName(
  editor?: { content: Ref<TemplateContent> } | null,
): (locale: string) => string {
  const localization = inject(LOCALIZATION_KEY, undefined);
  const activeEditor = editor === undefined ? inject(EDITOR_KEY, null) : editor;
  return (locale) => {
    const settings = activeEditor?.content.value.settings;
    const siblings = [
      ...(localization?.locales ?? []),
      settings?.locale,
      ...(settings?.locales ?? []),
    ].filter((tag): tag is string => !!tag);
    return languageName(locale, {
      siblings: [...new Set(siblings)],
      labels: localization?.languageNames,
    });
  };
}
