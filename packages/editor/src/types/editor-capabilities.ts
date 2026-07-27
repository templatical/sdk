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
  /**
   * Present only when a `SavedBlocksProvider` is configured — in OSS via
   * `init({ savedBlocks })`, in Cloud whenever cloud mode is active.
   */
  savedBlocks?: {
    /**
     * Begin a canvas pick session seeded with this block. Blocks are then
     * chosen by plain clicks until the floating bar confirms or cancels —
     * `EditorState.selectedBlockId` is untouched throughout.
     */
    startPicking(blockId: string): void;
    togglePick(blockId: string): void;
    isPicked(blockId: string): boolean;
    /** True while a pick session is running; block chrome swaps behaviour. */
    isPicking: ComputedRef<boolean>;
    /** Exposed so the shared keyboard handler can drive Enter/Escape. */
    confirmPicking(): void;
    cancelPicking(): void;
    openBrowser(): void;
    count: ComputedRef<number>;
    /**
     * Whether the feature is usable right now. Reactive because Cloud only
     * learns its plan entitlement after an async config fetch, which happens
     * *after* capabilities are provided — so presence alone can't encode it.
     * UI must gate on this, or it will render controls that do nothing.
     */
    isAvailable: ComputedRef<boolean>;
  };
}
