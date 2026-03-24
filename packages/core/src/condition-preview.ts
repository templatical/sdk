import type { UseEditorReturn } from './editor';
import { computed, reactive, type ComputedRef } from '@vue/reactivity';

export interface UseConditionPreviewReturn {
    isHidden: (blockId: string) => boolean;
    toggleBlock: (blockId: string) => void;
    reset: () => void;
    hasHiddenBlocks: ComputedRef<boolean>;
}

export function useConditionPreview(
    editor: UseEditorReturn,
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
