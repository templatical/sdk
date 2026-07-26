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
  isSaveDialogOpen: Ref<boolean>;
  preSelectedBlockId: Ref<string | null>;
  isBrowserOpen: Ref<boolean>;
  openSaveDialog: (blockId?: string) => void;
  closeSaveDialog: () => void;
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
 * Shared glue for the saved-blocks feature: reactive list, dialog state, the
 * insert operation, and the capability object the shared UI gates on.
 *
 * Both `Editor.vue` (OSS) and `useCloudInitialization` (Cloud) call this with
 * their own provider, so the two entry points run identical logic over
 * different transports. Nothing here is auth- or plan-aware — callers decide
 * whether the feature is available *before* constructing it, which is why the
 * capability's presence alone is a truthful signal that the UI will work.
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
  const preSelectedBlockId = ref<string | null>(null);
  const isBrowserOpen = ref(false);

  function openSaveDialog(blockId?: string): void {
    preSelectedBlockId.value = blockId ?? null;
    isSaveDialogOpen.value = true;
  }

  function closeSaveDialog(): void {
    isSaveDialogOpen.value = false;
  }

  function openBrowser(): void {
    isBrowserOpen.value = true;
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

  // Populate the list as soon as the feature becomes available, so the sidebar
  // rail (gated on count > 0) appears without the user opening the browser
  // first. `immediate` covers OSS, where availability is true from the start;
  // the watch covers Cloud, where it flips once the plan config resolves.
  watch(
    isAvailable,
    (available) => {
      if (available) refresh();
    },
    { immediate: true },
  );

  provide(SAVED_BLOCKS_KEY, headless);

  return {
    headless,
    isSaveDialogOpen,
    preSelectedBlockId,
    isBrowserOpen,
    openSaveDialog,
    closeSaveDialog,
    openBrowser,
    closeBrowser,
    insert,
    refresh,
    capability: {
      openSaveDialog: (blockId: string) => openSaveDialog(blockId),
      openBrowser,
      count,
      isAvailable,
    },
    count,
    isAvailable,
  };
}
