import type { MergeTag } from "@templatical/types";
import {
  resolveHtmlLogicMergeTagLabels,
  resolveHtmlMergeTagLabels,
} from "@templatical/types";
import { useElementBounding } from "@vueuse/core";
import { computed, inject, ref, type ComputedRef, type Ref } from "vue";
import { useMergeTag } from "./useMergeTag";

export interface UseEditableTextBlockReturn {
  isEditing: Ref<boolean>;
  blockRef: Ref<HTMLElement | null>;
  toolbarPosition: ComputedRef<{ top: number; left: number }>;
  resolvedContent: ComputedRef<string>;
  handleDoubleClick: () => void;
  handleEditorDone: () => void;
}

export function useEditableTextBlock(
  blockContent: () => string,
): UseEditableTextBlockReturn {
  const mergeTags = inject<MergeTag[]>("mergeTags", []);
  const { syntax } = useMergeTag();

  const resolvedContent = computed(() =>
    resolveHtmlLogicMergeTagLabels(
      resolveHtmlMergeTagLabels(blockContent(), mergeTags),
      syntax,
    ),
  );

  const isEditing = ref(false);
  const blockRef = ref<HTMLElement | null>(null);
  const { top: boundingTop, left: boundingLeft } = useElementBounding(blockRef);
  const toolbarPosition = computed(() => ({
    top: boundingTop.value - 8,
    left: boundingLeft.value,
  }));

  function handleDoubleClick(): void {
    isEditing.value = true;
  }

  function handleEditorDone(): void {
    isEditing.value = false;
  }

  return {
    isEditing,
    blockRef,
    toolbarPosition,
    resolvedContent,
    handleDoubleClick,
    handleEditorDone,
  };
}
