/**
 * Minimal typed interfaces for cloud-only capabilities injected into OSS
 * components. These define the contract that OSS components depend on —
 * the cloud layer satisfies these interfaces via its composables.
 */

import type { ComputedRef, Ref } from "vue";

export interface CloudPlanConfig {
  hasFeature: (feature: string) => boolean;
}

export interface CloudAiConfig {
  isFeatureEnabled: (feature: string) => boolean;
}

export interface CloudComments {
  commentCountByBlock: ComputedRef<Map<string, number>>;
}

export interface CloudSavedModules {
  headless: {
    modules: Ref<unknown[]>;
  };
  openSaveDialog: (blockId?: string) => void;
  openBrowserModal: () => void;
}
