import type { ComputedRef } from "vue";

export interface EditorCapabilities {
  plan?: {
    hasFeature(feature: string): boolean;
  };
  ai?: {
    isFeatureEnabled(feature: string): boolean;
  };
  comments?: {
    getBlockCount(blockId: string): number;
    openForBlock(blockId: string): void;
  };
  savedModules?: {
    openSaveDialog(blockId: string): void;
    openBrowser(): void;
    moduleCount: ComputedRef<number>;
  };
}
