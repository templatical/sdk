<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import type { TemplateContent } from "@templatical/types";
import type {
  UsePlanConfigReturn,
  UseEditorReturn as CloudUseEditorReturn,
} from "@templatical/core/cloud";

import type { UseEditorCoreReturn } from "../../composables/useEditorCore";
import type { UseCloudPanelStateReturn } from "../composables/useCloudPanelState";
import type { UseCloudMediaLibraryReturn } from "../composables/useCloudMediaLibrary";
import type { TemplaticalCloudEditorConfig } from "../cloudConfig";

const AiChatSidebar = defineAsyncComponent(() => import("./AiChatSidebar.vue"));
const CommentsSidebar = defineAsyncComponent(
  () => import("./CommentsSidebar.vue"),
);
const DesignReferenceSidebar = defineAsyncComponent(
  () => import("./DesignReferenceSidebar.vue"),
);
const TemplateScoringPanel = defineAsyncComponent(
  () => import("./TemplateScoringPanel.vue"),
);
const MediaLibraryModal = defineAsyncComponent(async () => {
  // try/catch downgrades Webpack's "Module not found" from error to warning
  // when the optional peer isn't installed. Cloud consumers always install it.
  try {
    const m = await import("@templatical/media-library");
    return m.MediaLibraryModal;
  } catch {
    throw new Error(
      "[Templatical] Cloud media library requires the optional peer dependency '@templatical/media-library'. Please install it.",
    );
  }
});

defineProps<{
  config: TemplaticalCloudEditorConfig;
  editor: CloudUseEditorReturn;
  core: UseEditorCoreReturn;
  panelState: UseCloudPanelStateReturn;
  planConfigInstance: UsePlanConfigReturn;
  mediaLib: UseCloudMediaLibraryReturn;
}>();

function applyContent(
  content: TemplateContent,
  core: UseEditorCoreReturn,
  editor: CloudUseEditorReturn,
): void {
  core.history.record();
  editor.setContent(content);
  core.conditionPreview.reset();
}

interface CommentsSidebarInstance {
  filterByBlock: (blockId: string) => void;
}

const commentsSidebar = ref<CommentsSidebarInstance | null>(null);

/** Delegates to the CommentsSidebar's filterByBlock method once it's mounted. */
function filterCommentsByBlock(blockId: string): void {
  commentsSidebar.value?.filterByBlock(blockId);
}

defineExpose({ filterCommentsByBlock });
</script>

<template>
  <AiChatSidebar
    :visible="panelState.aiChatOpen.value"
    :on-apply="(c: TemplateContent) => applyContent(c, core, editor)"
    @close="panelState.aiChatOpen.value = false"
  />

  <TemplateScoringPanel
    :visible="panelState.scoringPanelOpen.value"
    @close="panelState.scoringPanelOpen.value = false"
  />

  <DesignReferenceSidebar
    :visible="panelState.designReferenceOpen.value"
    :has-existing-blocks="editor.content.value.blocks.length > 0"
    @close="panelState.designReferenceOpen.value = false"
    @apply="(c: TemplateContent) => applyContent(c, core, editor)"
  />

  <CommentsSidebar
    ref="commentsSidebar"
    :visible="panelState.commentsOpen.value"
    @close="panelState.commentsOpen.value = false"
  />

  <MediaLibraryModal
    :visible="panelState.mediaLibraryOpen.value"
    :accept="panelState.mediaLibraryAccept.value"
    :popover-target="core.popoverRoot.value"
    @select="mediaLib.handleMediaSelect"
    @close="mediaLib.handleMediaLibraryClose"
  />
</template>
