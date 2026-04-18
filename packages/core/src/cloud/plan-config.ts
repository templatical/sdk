import type { PlanConfig, PlanFeatures } from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";
import { computed, ref, type ComputedRef, type Ref } from "vue";

export interface UsePlanConfigOptions {
  authManager: AuthManager;
  onError?: (error: Error) => void;
}

export interface UsePlanConfigReturn {
  config: Ref<PlanConfig | null>;
  isLoading: Ref<boolean>;
  hasFeature: (feature: keyof PlanFeatures) => boolean;
  features: ComputedRef<PlanFeatures | null>;
  fetchConfig: () => Promise<void>;
}

export function usePlanConfig(
  options: UsePlanConfigOptions,
): UsePlanConfigReturn {
  const { authManager, onError } = options;

  const config = ref<PlanConfig | null>(null);
  const isLoading = ref(false);

  const apiClient = new ApiClient(authManager);

  const features = computed(() => config.value?.features ?? null);

  function hasFeature(feature: keyof PlanFeatures): boolean {
    return config.value?.features[feature] ?? false;
  }

  async function fetchConfig(): Promise<void> {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;

    try {
      config.value = await apiClient.fetchConfig();
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error("Failed to fetch config", { cause: error }),
      );
    } finally {
      isLoading.value = false;
    }
  }

  return {
    config,
    isLoading,
    hasFeature,
    features,
    fetchConfig,
  };
}
