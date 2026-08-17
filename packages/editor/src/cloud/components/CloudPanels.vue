<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import type { TemplateContent } from "@templatical/types";
import type { UseEditorReturn } from "@templatical/core";

import type { UseEditorCoreReturn } from "../../composables/useEditorCore";
import type { CloudAttachment, CloudReady, CloudRuntime } from "../runtime";

import CloudErrorOverlay from "./CloudErrorOverlay.vue";
import CloudLoadingOverlay from "./CloudLoadingOverlay.vue";
import CloudSaveGateModal from "./CloudSaveGateModal.vue";
import CollabUndoToast from "./CollabUndoToast.vue";

const AiChatSidebar = defineAsyncComponent(() => import("./AiChatSidebar.vue"));
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

/**
 * Every piece of Cloud chrome that renders outside the header.
 *
 * `Editor.vue` mounts this behind one lazy `defineAsyncComponent` gated on a
 * cloud runtime being present, so an OSS consumer downloads none of it — the
 * `SavedBlocksPanels` / `TestEmailPanel` pattern.
 *
 * The overlays live here rather than in the shared editor deliberately: `init()`
 * cannot fail after it mounts, and OSS should not grow the ability.
 *
 * The comments sidebar is deliberately not here: it is shared, as `CommentsPanel`
 * in `Editor.vue` over a `CommentsProvider`. Its filter target lives on the shared
 * feature rather than being relayed through this component, so it survives the
 * lazy panel's mount without a runtime hop.
 */
const props = defineProps<{
  editor: UseEditorReturn;
  core: UseEditorCoreReturn;
  runtime: CloudRuntime;
  cloud: CloudAttachment;
  ready: CloudReady;
}>();

function applyContent(content: TemplateContent): void {
  props.core.history.record();
  props.editor.setContent(content);
  props.core.conditionPreview.reset();
}
</script>

<template>
  <!-- A template create / load in flight. Cloud reads its content from the
       server, so there is a real gap where the canvas shows the wrong thing. -->
  <Transition
    enter-active-class="tpl:transition-opacity tpl:duration-200"
    enter-from-class="tpl:opacity-100"
    enter-to-class="tpl:opacity-100"
    leave-active-class="tpl:transition-opacity tpl:duration-300"
    leave-from-class="tpl:opacity-100"
    leave-to-class="tpl:opacity-0"
  >
    <CloudLoadingOverlay :visible="editor.state.isLoading" />
  </Transition>

  <!-- Session failure — an auth refresh that could not renew the token. The
       *bootstrap* has no overlay any more: it runs before the mount, so a
       failure there rejects `initCloud()` instead of mounting a dead editor. -->
  <Transition
    enter-active-class="tpl:transition-opacity tpl:duration-200"
    enter-from-class="tpl:opacity-0"
    enter-to-class="tpl:opacity-100"
    leave-active-class="tpl:transition-opacity tpl:duration-300"
    leave-from-class="tpl:opacity-100"
    leave-to-class="tpl:opacity-0"
  >
    <CloudErrorOverlay
      :error="ready.sessionError.value"
      :visible="!!ready.sessionError.value"
      @retry="ready.retry"
    />
  </Transition>

  <CloudSaveGateModal
    :open="ready.saveGate.modalOpen.value"
    :issues="ready.saveGate.blockingIssues.value"
    @cancel="ready.saveGate.cancel"
    @confirm="ready.saveGate.confirmAndSave"
  />

  <Transition
    enter-active-class="tpl:transition-all tpl:duration-200 tpl:ease-out"
    enter-from-class="tpl:translate-y-[-8px] tpl:opacity-0"
    enter-to-class="tpl:translate-y-0 tpl:opacity-100"
    leave-active-class="tpl:transition-all tpl:duration-300 tpl:ease-in"
    leave-from-class="tpl:translate-y-0 tpl:opacity-100"
    leave-to-class="tpl:translate-y-[-8px] tpl:opacity-0"
  >
    <CollabUndoToast
      :visible="ready.collabWarning.collabUndoWarningVisible.value"
    />
  </Transition>

  <AiChatSidebar
    :visible="cloud.panelState.aiChatOpen.value"
    :on-apply="applyContent"
    @close="cloud.panelState.aiChatOpen.value = false"
  />

  <TemplateScoringPanel
    :visible="cloud.panelState.scoringPanelOpen.value"
    @close="cloud.panelState.scoringPanelOpen.value = false"
  />

  <DesignReferenceSidebar
    :visible="cloud.panelState.designReferenceOpen.value"
    :has-existing-blocks="editor.content.value.blocks.length > 0"
    @close="cloud.panelState.designReferenceOpen.value = false"
    @apply="applyContent"
  />

  <!-- `auth-manager` / `project-id` / `plan-config` are props, not injections.
       An injection would have to match the modal's key identity; a mismatch
       arrives as `undefined` with no error and the browser opens inert. -->
  <MediaLibraryModal
    :visible="cloud.panelState.mediaLibraryOpen.value"
    :accept="cloud.panelState.mediaLibraryAccept.value"
    :popover-target="core.popoverRoot.value"
    :auth-manager="cloud.mediaBrowser.authManager"
    :project-id="cloud.mediaBrowser.projectId"
    :plan-config="cloud.mediaBrowser.planConfig"
    @select="cloud.mediaLib.handleMediaSelect"
    @close="cloud.mediaLib.handleMediaLibraryClose"
  />
</template>
