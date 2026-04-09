import type { Translations } from "../i18n";
import { type Ref, inject, isRef } from "vue";

export interface UseI18nReturn {
  /** Current translations object */
  t: Translations;
  /** Format a string with placeholders */
  format: (template: string, values: Record<string, string | number>) => string;
}

/**
 * Composable for internationalization.
 * Provides access to the current locale's translations.
 *
 * @param translationsOverride - Optional translations to use instead of injected value
 */
export function useI18n(translationsOverride?: Translations): UseI18nReturn {
  const injected: Translations | Ref<Translations> | null =
    translationsOverride ??
    inject<Translations | Ref<Translations> | null>("translations", null);

  if (!injected) {
    throw new Error(
      "useI18n() requires a translations provider. Ensure the component is a descendant of Editor or CloudEditor.",
    );
  }

  const t = isRef(injected) ? injected.value : injected;

  /**
   * Format a string with placeholders.
   * e.g., format('{minutes}m ago', { minutes: 5 }) -> '5m ago'
   */
  function format(
    template: string,
    values: Record<string, string | number>,
  ): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return key in values ? String(values[key]) : `{${key}}`;
    });
  }

  return {
    t,
    format,
  };
}
