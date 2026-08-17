import type { ComputedRef, Ref } from "vue";

export interface EditorCapabilities {
  plan?: {
    hasFeature(feature: string): boolean;
  };
  ai?: {
    isFeatureEnabled(feature: string): boolean;
  };
  /**
   * Present only when a `CommentsProvider` **and** a `user` are configured — via
   * `init({ comments, user })`, or in Cloud whenever the plan grants `commenting`
   * (its `user` comes from the JWT).
   */
  comments?: {
    getBlockCount(blockId: string): number;
    openForBlock(blockId: string): void;
    /**
     * Whether the block exists in the **stored** template. A comment is anchored
     * server-side, so filtering to a block that only exists on the canvas has
     * nothing to show — the panel says so rather than rendering an empty list.
     *
     * Always `true` for a store that accepts any anchor; Cloud is what supplies a
     * real answer.
     */
    isBlockSaved(blockId: string): boolean;
    /**
     * Whether the feature is usable right now. Reactive for the same reason as
     * `savedBlocks.isAvailable`, plus one of its own: with no `user` there is
     * nobody to attribute a comment to, so the feature reports itself unavailable
     * rather than writing an anonymous one.
     */
    isAvailable: ComputedRef<boolean>;
    /** Open threads — the count badge on the header trigger. */
    unresolvedCount: ComputedRef<number>;
    /**
     * Which mutations the provider supplied — `false` instead of a function
     * withholds one. Shared UI hides the corresponding affordance: with all four
     * false the review is read-only (threads readable, jump-to-block working, no
     * way to add, edit, delete or resolve).
     */
    canCreate: ComputedRef<boolean>;
    canUpdate: ComputedRef<boolean>;
    canDelete: ComputedRef<boolean>;
    canResolve: ComputedRef<boolean>;
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
    /**
     * How many entries are loaded. Informational only — the sidebar rail is
     * gated on {@link isAvailable} alone, never on this, so a slow or empty
     * `list()` can't make the entry appear late or shift the rail.
     */
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
  /**
   * Present only when a `TestEmailProvider` is configured — in OSS via
   * `init({ testEmail })`, in Cloud whenever cloud mode is active (or when a
   * consumer supplied their own sender to `initCloud()`).
   */
  /**
   * Present only when a `TemplatesProvider` is configured — in OSS via
   * `init({ templates })`.
   *
   * Everything the header needs to render the template's identity and its save
   * state, so the same chrome works over any storage backend.
   */
  templates?: {
    /**
     * Persist now. Fire-and-forget: the outcome lands in {@link status}. A no-op
     * while a save is running, without a loaded template, or when the provider
     * withheld `save`.
     */
    save(): void;
    /**
     * Commit an inline rename and persist it. Empty names and no-change commits
     * are ignored.
     */
    rename(name: string): void;
    /** The loaded template's name, `undefined` when unnamed or not loaded. */
    name: ComputedRef<string | undefined>;
    /** Whether `create()` or `load()` has resolved — nothing to save until then. */
    hasTemplate: ComputedRef<boolean>;
    isSaving: ComputedRef<boolean>;
    /** Drives the three-state status indicator. */
    status: Ref<"idle" | "saved" | "error">;
    errorMessage: Ref<string>;
    /**
     * Which mutations the provider supplied — `false` instead of a function
     * withholds one. With `canSave` false the save button *and* the status
     * indicator disappear, and the name becomes read-only: there is nowhere for
     * a change to go.
     */
    canCreate: ComputedRef<boolean>;
    canSave: ComputedRef<boolean>;
    /**
     * Whether the feature is usable right now. Reactive for the same reason as
     * `savedBlocks.isAvailable`.
     */
    isAvailable: ComputedRef<boolean>;
  };
  /**
   * Present only when a `VersionHistoryProvider` is configured — via
   * `init({ versionHistory })` or `initCloud({ versionHistory })`.
   */
  versionHistory?: {
    /** Re-read the list from the provider. A no-op before a template exists. */
    refresh(): void;
    /** True while a past version is on the canvas instead of the user's work. */
    isPreviewing: ComputedRef<boolean>;
    /** Nothing has a history until `create()` or `load()` has resolved. */
    hasTemplate: ComputedRef<boolean>;
    /**
     * Whether the feature is usable right now. Reactive for the same reason as
     * `savedBlocks.isAvailable`.
     */
    isAvailable: ComputedRef<boolean>;
    /**
     * Which mutations the provider supplied — `false` instead of a function
     * withholds one. With `canRestore` false the history is browsable and
     * previewable but the Restore action does not render.
     */
    canCreate: ComputedRef<boolean>;
    canRestore: ComputedRef<boolean>;
  };
  testEmail?: {
    /** Open the send dialog. A no-op while {@link isAvailable} is false. */
    open(): void;
    /**
     * Whether the feature is usable right now. Reactive for the same reason as
     * `savedBlocks.isAvailable`: Cloud resolves its plan entitlement and its
     * allowed-recipient list *after* capabilities are provided, and an
     * explicitly empty allowlist makes the feature unusable. UI must gate on
     * this or it renders a button that does nothing.
     */
    isAvailable: ComputedRef<boolean>;
  };
}
