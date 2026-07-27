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
    /**
     * Which mutations the provider supplied — a provider may pass `false`
     * instead of a function to withhold one. Shared UI hides the corresponding
     * affordance: with `canCreate` false there is no bookmark action and so no
     * pick session, leaving a browse-and-insert-only library.
     *
     * Separate from {@link isAvailable}, which answers whether the feature
     * exists at all.
     */
    canCreate: ComputedRef<boolean>;
    canUpdate: ComputedRef<boolean>;
    canDelete: ComputedRef<boolean>;
  };
}
