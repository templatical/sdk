import type { MediaTranslations } from "../i18n";
import { type Ref, inject, isRef } from "vue";
import { TRANSLATIONS_KEY } from "../keys";
import en from "../i18n/locales/en";

export interface UseI18nReturn {
  /** Current translations object */
  t: MediaTranslations;
  /** Format a string with placeholders */
  format: (template: string, values: Record<string, string | number>) => string;
}

/**
 * Composable for internationalization.
 * Provides access to the current locale's translations.
 *
 * Resolution order: an explicit override, then `TRANSLATIONS_KEY` from the host
 * component, then bundled English.
 *
 * **English is a floor, not a feature.** `t` is read as `t.mediaLibrary.x` in 28
 * template positions in `MediaLibraryModal` alone and across eleven sibling
 * components, so an unresolved injection is not a missing label — it is a
 * `TypeError` on first render. The fallback keeps a wiring mistake to the wrong
 * *language* rather than a blank library, which is why the previous non-null
 * assertion is gone: it claimed something the type system could not back.
 *
 * The value is unwrapped **once, at setup** — deliberately, since every consumer
 * reads `t.mediaLibrary.x` directly rather than through a ref. A host whose
 * translations arrive asynchronously must therefore withhold its subtree until
 * they land (`MediaLibraryModal` gates on exactly that) rather than expecting a
 * later value to propagate.
 *
 * @param translationsOverride - Optional translations to use instead of the injected value
 */
export function useI18n(
  translationsOverride?: MediaTranslations,
): UseI18nReturn {
  const injected =
    translationsOverride ??
    inject<Ref<MediaTranslations | null> | null>(TRANSLATIONS_KEY, null);
  const resolved = isRef(injected) ? injected.value : injected;
  const t = resolved ?? en;

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
