import {
  resolveHtmlLogicMergeTagLabels,
  resolveHtmlMergeTagLabels,
} from "@templatical/types";
import { useElementBounding } from "@vueuse/core";
import { computed, inject, ref, type ComputedRef, type Ref } from "vue";
import { MERGE_TAGS_KEY } from "../keys";
import { useMergeTag } from "./useMergeTag";
import { usePopoverPosition } from "./usePopoverPosition";
import { sanitizeRichTextHtml } from "../utils/sanitizeRichTextHtml";

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
  const mergeTags = inject(MERGE_TAGS_KEY, []);
  const { syntax } = useMergeTag();

  // Sanitize before binding to `v-html`. TipTap-authored content is
  // already safe, but template JSON loaded from a consumer can carry
  // arbitrary HTML — including `<script>`, `<img onerror>`, or
  // `javascript:` anchors that would otherwise execute when the block
  // renders in the canvas.
  const resolvedContent = computed(() =>
    sanitizeRichTextHtml(
      resolveHtmlLogicMergeTagLabels(
        resolveHtmlMergeTagLabels(blockContent(), mergeTags),
        syntax,
      ),
    ),
  );

  const isEditing = ref(false);
  const blockRef = ref<HTMLElement | null>(null);
  const { top: boundingTop, left: boundingLeft } = useElementBounding(blockRef);
  // The floating toolbar teleports into the popover root and positions itself
  // `absolute`; convert the block's viewport rect to popover-root-local coords
  // so a transformed ancestor of the editor doesn't offset it. Recomputes with
  // `boundingTop/Left` (which track scroll/resize), re-reading the root each
  // time so the toolbar stays glued to the block. See usePopoverPosition.
  const { toLocal } = usePopoverPosition();
  const toolbarPosition = computed(() =>
    toLocal({ top: boundingTop.value - 8, left: boundingLeft.value }),
  );

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
