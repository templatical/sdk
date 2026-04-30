import type { CloudTranslations } from "../i18n";
import { type Ref, inject, isRef } from "vue";
import { CLOUD_TRANSLATIONS_KEY } from "../keys";

export interface UseCloudI18nReturn {
  /** Cloud translations, or null when running in OSS mode (no cloud chunk loaded). */
  t: CloudTranslations | null;
  /** Format a string with placeholders. */
  format: (template: string, values: Record<string, string | number>) => string;
}

export interface UseCloudI18nStrictReturn {
  t: CloudTranslations;
  format: (template: string, values: Record<string, string | number>) => string;
}

function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return key in values ? String(values[key]) : `{${key}}`;
  });
}

/**
 * Composable for cloud-only translations.
 * Returns `t: null` when no cloud chunk is provided (OSS mode), so shared
 * components can guard with `v-if="cloudT"` and render the cloud branch only
 * when both the cloud capability and its translations are available.
 *
 * For cloud-only components that always have cloud translations available,
 * use `useCloudI18nStrict()` to get a non-null type.
 */
export function useCloudI18n(
  translationsOverride?: CloudTranslations,
): UseCloudI18nReturn {
  const injected =
    translationsOverride ??
    (inject(CLOUD_TRANSLATIONS_KEY, null) as
      | CloudTranslations
      | Ref<CloudTranslations>
      | null);

  const t: CloudTranslations | null = injected
    ? isRef(injected)
      ? injected.value
      : injected
    : null;

  return { t, format };
}

/**
 * Strict variant of `useCloudI18n()` for cloud-only components.
 * Throws if cloud translations were not provided.
 */
export function useCloudI18nStrict(
  translationsOverride?: CloudTranslations,
): UseCloudI18nStrictReturn {
  const { t, format: f } = useCloudI18n(translationsOverride);
  if (!t) {
    throw new Error(
      "useCloudI18nStrict() requires a cloud translations provider. Ensure the component is a descendant of CloudEditor.",
    );
  }
  return { t, format: f };
}
