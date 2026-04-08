import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useTimeoutFn } from "@vueuse/core";
import type { UsePlanConfigReturn, UseAiConfigReturn } from "@templatical/core/cloud";

export interface UseCloudFeatureFlagsOptions {
  planConfigInstance: UsePlanConfigReturn;
  aiConfig: UseAiConfigReturn;
  editor: {
    state: {
      readonly template?: { id: string } | null;
    };
  };
}

export interface UseCloudFeatureFlagsReturn {
  canUseAiGeneration: ComputedRef<boolean>;
  canSendTestEmail: ComputedRef<boolean>;
  hasTemplateSaved: ComputedRef<boolean>;
  isWhiteLabeled: ComputedRef<boolean>;
  templateLimit: ComputedRef<number | null>;
  templateCount: ComputedRef<number>;
  isSaveExporting: Ref<boolean>;
  saveStatus: Ref<"idle" | "saved" | "error">;
  saveErrorMessage: Ref<string>;
  startSaveStatusClear: () => void;
}

export function useCloudFeatureFlags(
  options: UseCloudFeatureFlagsOptions,
): UseCloudFeatureFlagsReturn {
  const { planConfigInstance, aiConfig, editor } = options;

  const canUseAiGeneration = computed(
    () =>
      planConfigInstance.hasFeature("ai_generation") &&
      aiConfig.hasAnyMenuFeature.value,
  );
  const canSendTestEmail = computed(() =>
    planConfigInstance.hasFeature("test_email"),
  );
  const hasTemplateSaved = computed(() => !!editor.state.template?.id);
  const isWhiteLabeled = computed(() =>
    planConfigInstance.hasFeature("white_label"),
  );
  const templateLimit = computed(
    () => planConfigInstance.config.value?.limits.max_templates ?? null,
  );
  const templateCount = computed(
    () => planConfigInstance.config.value?.template_count ?? 0,
  );

  const isSaveExporting = ref(false);
  const saveStatus = ref<"idle" | "saved" | "error">("idle");
  const saveErrorMessage = ref("");

  const { start: startSaveStatusClear } = useTimeoutFn(
    () => {
      saveStatus.value = "idle";
    },
    3000,
    { immediate: false },
  );

  return {
    canUseAiGeneration,
    canSendTestEmail,
    hasTemplateSaved,
    isWhiteLabeled,
    templateLimit,
    templateCount,
    isSaveExporting,
    saveStatus,
    saveErrorMessage,
    startSaveStatusClear,
  };
}
