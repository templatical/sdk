import { computed, inject } from "vue";
import { EDITOR_KEY, LOCALIZATION_KEY } from "../keys";

/** Whether the active language is enabled for authoring. */
export function useLocaleEditable() {
  const editor = inject(EDITOR_KEY, null);
  const localization = inject(LOCALIZATION_KEY, undefined);
  return computed(() => {
    const locale = editor?.activeLocale?.value;
    return !locale || !localization || localization.locales.includes(locale);
  });
}
