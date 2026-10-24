import { computed, type ComputedRef } from "vue";
import type { UsePlanConfigReturn } from "@templatical/core/cloud";

export interface UseCloudFeatureFlagsOptions {
  planConfigInstance: UsePlanConfigReturn;
  /** The loaded template's id, or `null` before one exists. */
  getTemplateId: () => string | null;
}

export interface UseCloudFeatureFlagsReturn {
  canSendTestEmail: ComputedRef<boolean>;
  hasTemplateSaved: ComputedRef<boolean>;
  templateLimit: ComputedRef<number | null>;
  templateCount: ComputedRef<number>;
}

/**
 * Every entitlement check Cloud makes, in one place.
 *
 * The containment rule this exists for: entitlement checks go through here,
 * never inline in a component and never across a package boundary.
 *
 * Save status is deliberately not here — it lives on `useTemplatesFeature`, which
 * the one shared header reads, and was never an entitlement. Footer branding is
 * likewise not gated: `config.branding !== false` decides it on any plan. AI is
 * not here either: it is a provider (`init({ ai })`, A1), and Cloud's provider
 * arrives with S7.
 */
export function useCloudFeatureFlags(
  options: UseCloudFeatureFlagsOptions,
): UseCloudFeatureFlagsReturn {
  const { planConfigInstance, getTemplateId } = options;

  const canSendTestEmail = computed(() =>
    planConfigInstance.hasFeature("testEmail"),
  );
  const hasTemplateSaved = computed(() => getTemplateId() !== null);
  const templateLimit = computed(
    () => planConfigInstance.config.value?.limits.maxTemplates ?? null,
  );
  const templateCount = computed(
    () => planConfigInstance.config.value?.templateCount ?? 0,
  );

  return {
    canSendTestEmail,
    hasTemplateSaved,
    templateLimit,
    templateCount,
  };
}
