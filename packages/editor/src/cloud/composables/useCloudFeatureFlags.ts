import { computed, type ComputedRef } from "vue";
import type {
  UsePlanConfigReturn,
  UseAiConfigReturn,
} from "@templatical/core/cloud";

export interface UseCloudFeatureFlagsOptions {
  planConfigInstance: UsePlanConfigReturn;
  aiConfig: UseAiConfigReturn;
  /** The loaded template's id, or `null` before one exists. */
  getTemplateId: () => string | null;
}

export interface UseCloudFeatureFlagsReturn {
  canUseAiGeneration: ComputedRef<boolean>;
  canSendTestEmail: ComputedRef<boolean>;
  hasTemplateSaved: ComputedRef<boolean>;
  templateLimit: ComputedRef<number | null>;
  templateCount: ComputedRef<number>;
}

/**
 * Every entitlement check Cloud makes, in one place.
 *
 * The containment rule this exists for: entitlement checks go through here,
 * never inline in a component and never across a package boundary. With five
 * plan features left there is little excuse to break it.
 *
 * Save status is deliberately not here — it lives on `useTemplatesFeature`, which
 * the one shared header reads, and was never an entitlement. Footer branding is
 * likewise not gated: `config.branding !== false` decides it on any plan.
 */
export function useCloudFeatureFlags(
  options: UseCloudFeatureFlagsOptions,
): UseCloudFeatureFlagsReturn {
  const { planConfigInstance, aiConfig, getTemplateId } = options;

  const canUseAiGeneration = computed(
    () =>
      planConfigInstance.hasFeature("ai_generation") &&
      aiConfig.hasAnyMenuFeature.value,
  );
  const canSendTestEmail = computed(() =>
    planConfigInstance.hasFeature("test_email"),
  );
  const hasTemplateSaved = computed(() => getTemplateId() !== null);
  const templateLimit = computed(
    () => planConfigInstance.config.value?.limits.max_templates ?? null,
  );
  const templateCount = computed(
    () => planConfigInstance.config.value?.template_count ?? 0,
  );

  return {
    canUseAiGeneration,
    canSendTestEmail,
    hasTemplateSaved,
    templateLimit,
    templateCount,
  };
}
