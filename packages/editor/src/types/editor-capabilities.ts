import type { ComputedRef, Ref } from "vue";
import type { AiFeatureName, BlockLock } from "@templatical/types";

export interface EditorCapabilities {
  /**
   * Present only when an `AiProvider` is configured via `init({ ai })`. A
   * feature is enabled while its provider member is a function and a template
   * is loaded. chatAttachments also requires its flag and chat to be enabled.
   * Read inside a computed; it is reactive.
   */
  ai?: {
    isFeatureEnabled(feature: AiFeatureName): boolean;
    open(panel: "chat"): void;
    /** Queue references and open chat when chat attachments are available. */
    startImport(files: File[]): void;
    /**
     * While this editor's own AI turn outlines this block (no collaboration
     * provider), a number that changes with each turn; `null` otherwise.
     */
    highlightOf(blockId: string): number | null;
  };
  /**
   * Present only when a `CollaborationProvider` is configured — via
   * `init({ collaboration })`.
   */
  collaboration?: {
    /** The lock blocking this language view; omitted uses the active view, `null` the default. */
    lockOf(blockId: string, locale?: string | null): BlockLock | null;
    /**
     * While an AI agent's recent edit outlines this block, a number that
     * changes with each such edit, so the fade restarts; `null` otherwise.
     */
    agentHighlightOf(blockId: string): number | null;
  };
  /**
   * Present only when a `CommentsProvider` **and** a `user` are configured — via
   * `init({ comments, user })`.
   */
  comments?: {
    getBlockCount(blockId: string): number;
    openForBlock(blockId: string): void;
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
   * Present only when a `SavedBlocksProvider` is configured via
   * `init({ savedBlocks })`.
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
     * Whether the feature is usable right now. UI gates on this value.
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
    /**
     * When the stored template was last written, for the header's relative
     * label. `updatedAt` when the store supplies it, otherwise `createdAt`;
     * `null` when it supplies neither, which renders no line at all. `kind` is
     * what picks the "Updated"/"Created" wording.
     */
    timestamp: ComputedRef<{
      iso: string;
      kind: "updatedAt" | "createdAt";
    } | null>;
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
   * Present when a `VersionHistoryProvider` is configured via
   * `init({ versionHistory })`.
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
  /**
   * Present only when a `TestEmailProvider` is configured via
   * `init({ testEmail })`.
   */
  testEmail?: {
    /** Open the send dialog. A no-op while {@link isAvailable} is false. */
    open(): void;
    /**
     * Whether the feature is usable right now. UI gates on this value.
     */
    isAvailable: ComputedRef<boolean>;
  };
}
