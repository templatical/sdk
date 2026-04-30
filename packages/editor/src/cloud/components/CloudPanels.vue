<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import type { Block, TemplateContent } from "@templatical/types";
import type {
  UsePlanConfigReturn,
  UseTestEmailReturn,
  UseEditorReturn as CloudUseEditorReturn,
} from "@templatical/core/cloud";

import type { UseEditorCoreReturn } from "../../composables/useEditorCore";
import type { UseCloudPanelStateReturn } from "../composables/useCloudPanelState";
import type { UseCloudMediaLibraryReturn } from "../composables/useCloudMediaLibrary";
import type { UseCloudInitializationReturn } from "../composables/useCloudInitialization";
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
const TestEmailModal = defineAsyncComponent(
  () => import("./TestEmailModal.vue"),
);
const SaveModuleDialog = defineAsyncComponent(
  () => import("./SaveModuleDialog.vue"),
);
const ModuleBrowserModal = defineAsyncComponent(
  () => import("./ModuleBrowserModal.vue"),
);
const MediaLibraryModal = defineAsyncComponent(async () => {
  const m = await import("@templatical/media-library");
  return m.MediaLibraryModal;
});

defineProps<{
  config: TemplaticalCloudEditorConfig;
  editor: CloudUseEditorReturn;
  core: UseEditorCoreReturn;
  panelState: UseCloudPanelStateReturn;
  planConfigInstance: UsePlanConfigReturn;
  testEmail: UseTestEmailReturn;
  mediaLib: UseCloudMediaLibraryReturn;
  savedModulesHeadless: UseCloudInitializationReturn["savedModulesHeadless"];
  showSaveModuleDialog: boolean;
  saveModulePreSelectedBlockId: string | null;
  showModuleBrowserModal: boolean;
}>();

const emit = defineEmits<{
  (e: "update:showSaveModuleDialog", value: boolean): void;
  (e: "update:saveModulePreSelectedBlockId", value: string | null): void;
  (e: "update:showModuleBrowserModal", value: boolean): void;
  (e: "send-test-email", recipient: string): void;
  (
    e: "module-insert",
    module: { content: Block[] },
    insertIndex: number | undefined,
  ): void;
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

function handleModuleInsert(
  mod: { content: Block[] },
  idx: number | undefined,
): void {
  emit("module-insert", mod, idx);
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

  <TestEmailModal
    :visible="panelState.testEmailModalOpen.value"
    :allowed-emails="testEmail.allowedEmails.value"
    :is-sending="testEmail.isSending.value"
    :error="testEmail.error.value"
    @send="(recipient: string) => emit('send-test-email', recipient)"
    @close="panelState.testEmailModalOpen.value = false"
  />

  <SaveModuleDialog
    v-if="
      planConfigInstance.hasFeature('saved_modules') && config.modules !== false
    "
    :visible="showSaveModuleDialog"
    :pre-selected-block-id="saveModulePreSelectedBlockId"
    @close="
      emit('update:showSaveModuleDialog', false);
      emit('update:saveModulePreSelectedBlockId', null);
    "
    @saved="savedModulesHeadless.loadModules()"
  />

  <ModuleBrowserModal
    v-if="
      planConfigInstance.hasFeature('saved_modules') && config.modules !== false
    "
    :visible="showModuleBrowserModal"
    @close="emit('update:showModuleBrowserModal', false)"
    @insert="handleModuleInsert"
  />

  <MediaLibraryModal
    :visible="panelState.mediaLibraryOpen.value"
    :accept="panelState.mediaLibraryAccept.value"
    @select="mediaLib.handleMediaSelect"
    @close="mediaLib.handleMediaLibraryClose"
  />
</template>
