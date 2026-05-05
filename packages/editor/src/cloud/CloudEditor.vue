<script setup lang="ts">
import type { Block, TemplateContent } from "@templatical/types";
import { cloneBlock } from "@templatical/types";

import type { UseFontsReturn } from "../composables/useFonts";
import { onMounted, onUnmounted, ref } from "vue";
import { RotateCcw } from "@lucide/vue";
import type { Translations, CloudTranslations } from "../i18n";
import { provide } from "vue";
import { CLOUD_TRANSLATIONS_KEY } from "../keys";

import { useCloudInitialization } from "./composables/useCloudInitialization";
import { useCloudLifecycle } from "./composables/useCloudLifecycle";
import { useCloudSaveGate } from "./composables/useCloudSaveGate";
import CloudSaveGateModal from "./components/CloudSaveGateModal.vue";
import CloudHeader from "./components/CloudHeader.vue";
import CloudPanels from "./components/CloudPanels.vue";
import EditorFooter from "../components/EditorFooter.vue";

import Canvas from "../components/Canvas.vue";
import Sidebar from "../components/Sidebar.vue";
import RightSidebar from "../components/RightSidebar.vue";
import CloudLoadingOverlay from "./components/CloudLoadingOverlay.vue";
import CloudErrorOverlay from "./components/CloudErrorOverlay.vue";
import SnapshotPreviewBanner from "./components/SnapshotPreviewBanner.vue";
import CollabUndoToast from "./components/CollabUndoToast.vue";
import "../styles/index.css";

export type { TemplaticalCloudEditorConfig } from "./cloudConfig";
import type { TemplaticalCloudEditorConfig } from "./cloudConfig";

const props = defineProps<{
  config: TemplaticalCloudEditorConfig;
  translations: Translations;
  cloudTranslations: CloudTranslations;
  fontsManager: UseFontsReturn;
}>();

provide(CLOUD_TRANSLATIONS_KEY, props.cloudTranslations);
const emit = defineEmits<{
  (e: "ready"): void;
}>();

// Template ref for CloudPanels. Its `filterCommentsByBlock()` method is what
// init.openCommentsForBlock() bridges to once the panel mounts.
const cloudPanelsRef = ref<{
  filterCommentsByBlock: (blockId: string) => void;
} | null>(null);

const init = useCloudInitialization({
  config: props.config,
  translations: props.translations,
  fontsManager: props.fontsManager,
  emit,
  getCommentsSidebar: () =>
    cloudPanelsRef.value
      ? { filterByBlock: cloudPanelsRef.value.filterCommentsByBlock }
      : null,
});

// Destructure heavily-used members for template readability.
const {
  isInitializing,
  isAuthReady,
  initError,
  planConfigInstance,
  websocket,
  collaboration,
  isCollaborationEnabled,
  editor,
  core,
  featureFlags,
  mediaLib,
  exporter,
  testEmail,
  commentsInstance,
  savedModulesHeadless,
  panelState,
  snapshotPreview,
  collabWarning,
  showSaveModuleDialog,
  showModuleBrowserModal,
  saveModulePreSelectedBlockId,
  setThemeOverrides,
  setUiTheme,
} = init;

// ---------------------------------------------------------------------------
// Test email handler
// ---------------------------------------------------------------------------

async function handleSendTestEmail(recipient: string): Promise<void> {
  try {
    await testEmail.sendTestEmail(recipient);
    panelState.testEmailModalOpen.value = false;
  } catch {
    // Error is already handled in the composable
  }
}

// ---------------------------------------------------------------------------
// Module insert handler
// ---------------------------------------------------------------------------

function handleModuleInsert(
  module: { content: Block[] },
  insertIndex: number | undefined,
): void {
  for (let i = 0; i < module.content.length; i++) {
    const cloned = cloneBlock(module.content[i]);
    const position = insertIndex !== undefined ? insertIndex + i : undefined;
    editor.addBlock(cloned, undefined, undefined, position);
  }
  showModuleBrowserModal.value = false;
}

// ---------------------------------------------------------------------------
// Template lifecycle (create/load/save)
// ---------------------------------------------------------------------------

const lifecycle = useCloudLifecycle({
  config: props.config,
  editor,
  websocket,
  planConfigInstance,
  snapshotPreview,
  core,
  exporter,
  featureFlags,
  isDestroyed: init.isDestroyed,
});

// --- Accessibility save-gate ---
const saveGate = useCloudSaveGate({
  issues: core.accessibilityLint ? core.accessibilityLint.issues : ref([]),
  planConfig: planConfigInstance.config,
});

async function gatedSave(): Promise<void> {
  await saveGate.tryRunSave(() =>
    lifecycle.saveTemplate().catch((err: Error) => props.config.onError?.(err)),
  );
}

// Route the keyboard Save hook through the gate so Cmd+S also triggers the
// modal when the plan policy says so.
init.onSaveHook.value = gatedSave;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  init.initialize();
});

onUnmounted(() => {
  init.destroy();
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

defineExpose({
  getContent: () => editor.content.value,
  setContent: (content: TemplateContent) => editor.setContent(content),
  setTheme: setUiTheme,
  setThemeOverrides: setThemeOverrides,
  create: lifecycle.createTemplate,
  load: lifecycle.loadTemplate,
  save: lifecycle.saveTemplate,
  sendTestEmail: testEmail.sendTestEmail,
});
</script>

<template>
  <div
    class="tpl tpl:relative tpl:h-full tpl:overflow-hidden"
    :class="{ 'tpl:dark': editor.state.darkMode }"
    :data-tpl-theme="core.resolvedTheme.value"
    :style="core.themeStyles.value"
  >
    <!-- Loading overlay -->
    <Transition
      enter-active-class="tpl:transition-opacity tpl:duration-200"
      enter-from-class="tpl:opacity-100"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition-opacity tpl:duration-300"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <CloudLoadingOverlay
        :visible="isInitializing || editor.state.isLoading"
      />
    </Transition>

    <!-- Error overlay -->
    <Transition
      enter-active-class="tpl:transition-opacity tpl:duration-200"
      enter-from-class="tpl:opacity-0"
      enter-to-class="tpl:opacity-100"
      leave-active-class="tpl:transition-opacity tpl:duration-300"
      leave-from-class="tpl:opacity-100"
      leave-to-class="tpl:opacity-0"
    >
      <CloudErrorOverlay
        :error="initError"
        :visible="!!initError && !isInitializing"
        @retry="init.initialize"
      />
    </Transition>

    <CloudHeader
      :editor="editor"
      :core="core"
      :feature-flags="featureFlags"
      :panel-state="panelState"
      :snapshot-preview="snapshotPreview"
      :comments-instance="commentsInstance"
      :test-email="testEmail"
      :websocket="websocket"
      :collaboration="collaboration"
      :is-collaboration-enabled="isCollaborationEnabled"
      :is-saving="editor.state.isSaving || featureFlags.isSaveExporting.value"
      :is-save-disabled="
        editor.state.isSaving ||
        featureFlags.isSaveExporting.value ||
        !editor.state.isDirty
      "
      @save="gatedSave"
    />

    <CloudSaveGateModal
      :open="saveGate.modalOpen.value"
      :issues="saveGate.blockingIssues.value"
      @cancel="saveGate.cancel"
      @confirm="saveGate.confirmAndSave"
    />

    <!-- Snapshot preview banner -->
    <SnapshotPreviewBanner
      :visible="snapshotPreview.isPreviewingSnapshot.value"
      @cancel="snapshotPreview.cancelPreview"
      @confirm="snapshotPreview.confirmRestoreSnapshot"
    />

    <!-- Collaboration undo warning toast -->
    <Transition
      enter-active-class="tpl:transition-all tpl:duration-200 tpl:ease-out"
      enter-from-class="tpl:translate-y-[-8px] tpl:opacity-0"
      enter-to-class="tpl:translate-y-0 tpl:opacity-100"
      leave-active-class="tpl:transition-all tpl:duration-300 tpl:ease-in"
      leave-from-class="tpl:translate-y-0 tpl:opacity-100"
      leave-to-class="tpl:translate-y-[-8px] tpl:opacity-0"
    >
      <CollabUndoToast
        :visible="collabWarning.collabUndoWarningVisible.value"
      />
    </Transition>

    <!-- Left sidebar -->
    <Sidebar v-show="!editor.state.previewMode" />

    <!-- Canvas body -->
    <div
      class="tpl-body tpl:absolute tpl:bottom-0 tpl:overflow-auto"
      style="
        transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
        background-color: var(--tpl-canvas-bg);
      "
      :class="[
        editor.state.previewMode
          ? 'tpl:left-0 tpl:right-0'
          : panelState.rightPanelOpen.value
            ? 'tpl:left-12 tpl:right-[680px]'
            : 'tpl:left-12 tpl:right-[320px]',
        snapshotPreview.isPreviewingSnapshot.value
          ? 'tpl:top-[104px]'
          : 'tpl:top-14',
      ]"
    >
      <!-- Restore hidden blocks button -->
      <div class="tpl:sticky tpl:top-0 tpl:z-40 tpl:h-0">
        <Transition name="tpl-restore-btn">
          <button
            v-if="core.conditionPreview.hasHiddenBlocks.value"
            class="tpl:absolute tpl:left-1/2 tpl:top-2 tpl:-translate-x-1/2 tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-full tpl:border tpl:px-3.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:whitespace-nowrap tpl:shadow-md tpl:hover:opacity-80"
            style="
              background-color: var(--tpl-warning-light);
              color: var(--tpl-warning);
              border-color: var(--tpl-warning);
              backdrop-filter: blur(8px);
            "
            @click="core.conditionPreview.reset()"
          >
            <RotateCcw :size="13" :stroke-width="2" />
            {{ core.t.blockSettings.restoreHiddenBlocks }}
          </button>
        </Transition>
      </div>
      <main class="tpl-main tpl:flex tpl:justify-center tpl:p-8">
        <Canvas
          :viewport="editor.state.viewport"
          :content="editor.content.value"
          :selected-block-id="editor.state.selectedBlockId"
          :dark-mode="editor.state.darkMode"
          :preview-mode="editor.state.previewMode"
          :locked-blocks="collaboration?.lockedBlocks.value ?? undefined"
          @select-block="editor.selectBlock"
          @open-ai-chat="panelState.aiChatOpen.value = true"
          @open-design-reference="panelState.designReferenceOpen.value = true"
        />
      </main>
    </div>

    <EditorFooter
      v-if="config.branding !== false && !featureFlags.isWhiteLabeled.value"
      :position-class="[
        editor.state.previewMode
          ? 'tpl:left-0 tpl:right-0'
          : panelState.rightPanelOpen.value
            ? 'tpl:left-12 tpl:right-[680px]'
            : 'tpl:left-12 tpl:right-[320px]',
      ]"
    />

    <!-- Keyboard reorder announcement region (visually hidden, screen-reader live) -->
    <div
      class="tpl-sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-label="core.t.landmarks.reorderAnnouncements"
    >
      {{ core.keyboardReorder.announcement.value }}
    </div>

    <!-- Right sidebar — persisted with v-show -->
    <RightSidebar
      v-show="!editor.state.previewMode"
      :selected-block="editor.selectedBlock.value"
      :settings="editor.content.value.settings"
      :shifted-left="panelState.rightPanelOpen.value"
      @update-block="
        (updates) => editor.updateBlock(editor.selectedBlock.value!.id, updates)
      "
      @delete-block="
        core.blockActions.deleteBlock(editor.selectedBlock.value!.id)
      "
      @duplicate-block="
        core.blockActions.duplicateBlock(editor.selectedBlock.value!)
      "
      @update-settings="editor.updateSettings"
    />

    <!-- Cloud sidebars + modals — only mount after cloud init completes -->
    <CloudPanels
      v-if="!isInitializing && isAuthReady"
      ref="cloudPanelsRef"
      :config="props.config"
      :editor="editor"
      :core="core"
      :panel-state="panelState"
      :plan-config-instance="planConfigInstance"
      :test-email="testEmail"
      :media-lib="mediaLib"
      :saved-modules-headless="savedModulesHeadless"
      :show-save-module-dialog="showSaveModuleDialog"
      :save-module-pre-selected-block-id="saveModulePreSelectedBlockId"
      :show-module-browser-modal="showModuleBrowserModal"
      @update:show-save-module-dialog="showSaveModuleDialog = $event"
      @update:save-module-pre-selected-block-id="
        saveModulePreSelectedBlockId = $event
      "
      @update:show-module-browser-modal="showModuleBrowserModal = $event"
      @send-test-email="handleSendTestEmail"
      @module-insert="handleModuleInsert"
    />
  </div>
</template>

<style scoped>
.tpl-restore-btn-enter-active {
  transition:
    opacity 200ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-restore-btn-leave-active {
  transition:
    opacity 150ms ease-in,
    transform 150ms ease-in;
}

.tpl-restore-btn-enter-from,
.tpl-restore-btn-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.9);
}

.tpl-restore-btn-enter-to,
.tpl-restore-btn-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
