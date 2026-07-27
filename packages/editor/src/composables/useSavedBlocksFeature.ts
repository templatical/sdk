import { computed, provide, ref, watch, type ComputedRef, type Ref } from "vue";
import { useSavedBlocks, type UseSavedBlocksReturn } from "@templatical/core";
import type {
  Block,
  SavedBlock,
  SavedBlocksProvider,
} from "@templatical/types";
import { cloneBlock } from "@templatical/types";
import { SAVED_BLOCKS_KEY } from "../keys";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** Minimal slice of the editor this feature needs — satisfied by OSS and Cloud alike. */
interface SavedBlocksEditor {
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  /** Read reactively to cancel a pick session when preview mode turns on. */
  state: { previewMode: boolean };
}

export interface UseSavedBlocksFeatureOptions {
  /** Storage backend — consumer-supplied in OSS, the Cloud adapter in Cloud. */
  provider: SavedBlocksProvider;
  editor: SavedBlocksEditor;
  onError?: (error: Error) => void;
  /**
   * Whether the feature may be used. Read reactively, so Cloud can defer to a
   * plan entitlement that only resolves after its async config fetch. Omit for
   * always-available (the OSS case: a configured provider is the whole gate).
   */
  isAvailable?: () => boolean;
}

export interface UseSavedBlocksFeatureReturn {
  headless: UseSavedBlocksReturn;

  // --- Pick session ---
  isPicking: ComputedRef<boolean>;
  pickedIds: Ref<Set<string>>;
  pickedCount: ComputedRef<number>;
  startPicking: (blockId: string) => void;
  togglePick: (blockId: string) => void;
  isPicked: (blockId: string) => boolean;
  confirmPicking: () => void;
  cancelPicking: () => void;

  // --- Dialogs ---
  isSaveDialogOpen: Ref<boolean>;
  closeSaveDialog: () => void;
  isBrowserOpen: Ref<boolean>;
  openBrowser: () => void;
  closeBrowser: () => void;

  /** Insert a saved block's content into the canvas, with fresh block IDs. */
  insert: (saved: SavedBlock, insertIndex: number | undefined) => void;
  /** Re-read the list from the provider (used after a successful save). */
  refresh: () => void;
  /** Capability object handed to `useEditorCore` so shared UI can light up. */
  capability: NonNullable<EditorCapabilities["savedBlocks"]>;
  count: ComputedRef<number>;
  isAvailable: ComputedRef<boolean>;
}

/**
 * Shared glue for the saved-blocks feature: reactive list, the canvas pick
 * session, the insert operation, and the capability object the shared UI gates
 * on.
 *
 * Both `Editor.vue` (OSS) and `useCloudInitialization` (Cloud) call this with
 * their own provider, so the two entry points run identical logic over
 * different transports. Nothing here is auth- or plan-aware — callers decide
 * whether the feature is available *before* constructing it.
 *
 * **The pick session is deliberately local to this feature.** Choosing which
 * blocks to save happens on the canvas (the user's mental model is spatial),
 * but it does NOT touch `EditorState.selectedBlockId`: keeping it a transient
 * mode avoids a breaking core-state change, leaves Cloud's single-block
 * selection broadcast and block locking untouched, and steers clear of
 * Sortable multi-drag. Promote it to real multi-select only if a second
 * consumer needs it.
 *
 * Must be called from `setup()`: it `provide()`s the headless instance under
 * {@link SAVED_BLOCKS_KEY} for the dialogs to inject.
 */
export function useSavedBlocksFeature(
  options: UseSavedBlocksFeatureOptions,
): UseSavedBlocksFeatureReturn {
  const { provider, editor } = options;

  const headless = useSavedBlocks({ provider, onError: options.onError });

  const isSaveDialogOpen = ref(false);
  const isBrowserOpen = ref(false);

  // --- Pick session ---
  const picking = ref(false);
  const pickedIds = ref<Set<string>>(new Set());
  const isPicking = computed(() => picking.value);
  const pickedCount = computed(() => pickedIds.value.size);

  function startPicking(blockId: string): void {
    // Nothing to pick *for* when the provider withheld `create` — the dialog at
    // the end of the session would have no way to persist. The bookmark action
    // is already hidden; this covers programmatic callers.
    if (!headless.canCreate.value) return;
    // Preview mode has no block chrome to pick with, and its click handlers are
    // suppressed — a session there could never be completed or cancelled.
    if (editor.state.previewMode) return;
    pickedIds.value = new Set([blockId]);
    picking.value = true;
  }

  function togglePick(blockId: string): void {
    if (!picking.value) return;
    const next = new Set(pickedIds.value);
    if (next.has(blockId)) {
      next.delete(blockId);
    } else {
      next.add(blockId);
    }
    pickedIds.value = next;
  }

  function isPicked(blockId: string): boolean {
    return pickedIds.value.has(blockId);
  }

  function cancelPicking(): void {
    picking.value = false;
    pickedIds.value = new Set();
  }

  function confirmPicking(): void {
    if (pickedCount.value === 0) return;
    // Leave pick mode but keep the set — the dialog reads it to know what it's
    // saving. `closeSaveDialog` is what clears it.
    picking.value = false;
    isSaveDialogOpen.value = true;
    // The dialog offers the categories already in use as suggestions, and those
    // are derived from the loaded list — without this they'd be empty for anyone
    // who saves without ever opening the browser, and the derived-category model
    // would drift into near-duplicates.
    refresh();
  }

  function closeSaveDialog(): void {
    isSaveDialogOpen.value = false;
    pickedIds.value = new Set();
  }

  // A session can't survive entering preview mode: the canvas stops responding
  // to selection there, so the bar would be the only way out.
  watch(
    () => editor.state.previewMode,
    (previewMode) => {
      if (previewMode && picking.value) cancelPicking();
    },
  );

  function openBrowser(): void {
    isBrowserOpen.value = true;
    refresh();
  }

  function closeBrowser(): void {
    isBrowserOpen.value = false;
  }

  function insert(saved: SavedBlock, insertIndex: number | undefined): void {
    for (let i = 0; i < saved.content.length; i++) {
      // cloneBlock regenerates ids (recursively for section children) so the
      // inserted copy never collides with the stored one, or with blocks
      // already on the canvas from a previous insert of the same entry.
      const cloned = cloneBlock(saved.content[i]);
      const position = insertIndex !== undefined ? insertIndex + i : undefined;
      editor.addBlock(cloned, undefined, undefined, position);
    }
    isBrowserOpen.value = false;
  }

  function refresh(): void {
    // Fire-and-forget: `useSavedBlocks` already routes failures to `onError`,
    // and a stale list is not worth blocking the dialog's close on.
    void headless.load().catch(() => {});
  }

  const count = computed(() => headless.savedBlocks.value.length);
  const isAvailable = computed(() => options.isAvailable?.() ?? true);

  /**
   * Nothing is fetched at mount — the list loads when the browser or the save
   * dialog opens. So a consumer's `list()` latency can neither delay the editor
   * nor shift the sidebar: the rail entry is gated purely on availability, and
   * its presence no longer depends on whether anything happens to be saved.
   *
   * True only while there is *nothing to show*, which is what makes the browser
   * skeleton appear on a first open and stay away on a reopen — the previous
   * results render immediately while the refetch lands underneath. Without that
   * distinction the empty state would read "No saved blocks yet" for however
   * long the request takes, which is false rather than merely unhelpful.
   *
   * The browser modal derives that condition itself from the injected composable
   * — it is the only surface that displays the list, so there is no reason to
   * widen the capability with it.
   */

  provide(SAVED_BLOCKS_KEY, headless);

  return {
    headless,

    isPicking,
    pickedIds,
    pickedCount,
    startPicking,
    togglePick,
    isPicked,
    confirmPicking,
    cancelPicking,

    isSaveDialogOpen,
    closeSaveDialog,
    isBrowserOpen,
    openBrowser,
    closeBrowser,

    insert,
    refresh,
    capability: {
      startPicking,
      togglePick,
      isPicked,
      isPicking,
      confirmPicking,
      cancelPicking,
      openBrowser,
      count,
      isAvailable,
      canCreate: headless.canCreate,
      canUpdate: headless.canUpdate,
      canDelete: headless.canDelete,
    },
    count,
    isAvailable,
  };
}
