import { computed, reactive, type ComputedRef } from "@vue/reactivity";

export interface UseConditionPreviewReturn {
  isHidden: (blockId: string) => boolean;
  toggleBlock: (blockId: string) => void;
  reset: () => void;
  hasHiddenBlocks: ComputedRef<boolean>;
}

/**
 * The slice of an editor this needs — deliberately structural, so both the OSS
 * and the Cloud `useEditor` satisfy it without either having to grow toward the
 * other.
 */
export interface ConditionPreviewEditor {
  state: { readonly selectedBlockId: string | null };
  selectBlock: (blockId: string | null) => void;
}

export function useConditionPreview(
  editor: ConditionPreviewEditor,
): UseConditionPreviewReturn {
  const hiddenBlockIds = reactive(new Set<string>());

  const hasHiddenBlocks = computed(() => hiddenBlockIds.size > 0);

  function isHidden(blockId: string): boolean {
    return hiddenBlockIds.has(blockId);
  }

  function toggleBlock(blockId: string): void {
    if (hiddenBlockIds.has(blockId)) {
      hiddenBlockIds.delete(blockId);
    } else {
      hiddenBlockIds.add(blockId);

      if (editor.state.selectedBlockId === blockId) {
        editor.selectBlock(null);
      }
    }
  }

  function reset(): void {
    hiddenBlockIds.clear();
  }

  return {
    isHidden,
    toggleBlock,
    reset,
    hasHiddenBlocks,
  };
}
