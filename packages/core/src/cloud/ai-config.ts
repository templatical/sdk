import type { AiConfig } from '@templatical/types';
import { computed, type ComputedRef } from 'vue';

export interface UseAiConfigReturn {
    isFeatureEnabled: (feature: keyof AiConfig) => boolean;
    hasAnyMenuFeature: ComputedRef<boolean>;
}

export function useAiConfig(config?: AiConfig | false): UseAiConfigReturn {
    function isFeatureEnabled(feature: keyof AiConfig): boolean {
        if (config === false) {
            return false;
        }

        return config?.[feature] !== false;
    }

    const hasAnyMenuFeature = computed(
        () =>
            isFeatureEnabled('chat') ||
            isFeatureEnabled('scoring') ||
            isFeatureEnabled('designToTemplate'),
    );

    return {
        isFeatureEnabled,
        hasAnyMenuFeature,
    };
}
