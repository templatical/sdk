<script setup lang="ts">
import {
  Check,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  Save,
  Send,
  Sparkles,
} from "@lucide/vue";
import { defineAsyncComponent } from "vue";
import type {
  AuthManager,
  UseCommentsReturn,
  UseTestEmailReturn,
  UseWebSocketReturn,
  UseEditorReturn as CloudUseEditorReturn,
} from "@templatical/core/cloud";

import type { UseEditorCoreReturn } from "../../composables/useEditorCore";
import { headerBtnClass } from "../../constants/styleConstants";
import ViewportToggle from "../../components/ViewportToggle.vue";
import PreviewToggle from "../../components/PreviewToggle.vue";
import DarkModeToggle from "../../components/DarkModeToggle.vue";
import type { UseCloudFeatureFlagsReturn } from "../composables/useCloudFeatureFlags";
import type { UseCloudPanelStateReturn } from "../composables/useCloudPanelState";
import type { UseSnapshotPreviewReturn } from "../composables/useSnapshotPreview";
import type { UseCloudInitializationReturn } from "../composables/useCloudInitialization";

const CollaboratorBar = defineAsyncComponent(
  () => import("./CollaboratorBar.vue"),
);
const SnapshotHistory = defineAsyncComponent(
  () => import("./SnapshotHistory.vue"),
);
const AiFeatureMenu = defineAsyncComponent(
  () => import("./AiFeatureMenu.vue"),
);

defineProps<{
  editor: CloudUseEditorReturn;
  core: UseEditorCoreReturn;
  authManager: AuthManager;
  featureFlags: UseCloudFeatureFlagsReturn;
  panelState: UseCloudPanelStateReturn;
  snapshotPreview: UseSnapshotPreviewReturn;
  commentsInstance: UseCommentsReturn;
  testEmail: UseTestEmailReturn;
  websocket: UseWebSocketReturn;
  collaboration: UseCloudInitializationReturn["collaboration"];
  isCollaborationEnabled: boolean;
  isSaveDisabled: boolean;
  isSaving: boolean;
}>();

defineEmits<{
  (e: "save"): void;
}>();
</script>

<template>
  <header
    class="tpl-header tpl:absolute tpl:top-0 tpl:right-0 tpl:left-0 tpl:z-50 tpl:grid tpl:h-14 tpl:grid-cols-[1fr_auto_1fr] tpl:items-center tpl:px-4"
    style="
      background-color: color-mix(in srgb, var(--tpl-bg) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: var(--tpl-shadow-md);
      border-bottom: 1px solid var(--tpl-border);
    "
  >
    <!-- Left: Logo + template count -->
    <div
      class="tpl-header-left tpl:flex tpl:min-w-[200px] tpl:items-center tpl:gap-3"
    >
      <div
        v-if="!featureFlags.isWhiteLabeled.value"
        class="tpl-logo tpl:flex tpl:items-center tpl:gap-2.5 tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
      >
        <img
          :src="authManager.resolveUrl('/logo.svg')"
          alt="Templatical"
          width="24"
          height="24"
          class="tpl:shrink-0"
        />
        <span style="letter-spacing: -0.01em">{{ core.t.header.title }}</span>
      </div>
      <span
        v-if="featureFlags.templateLimit.value !== null"
        class="tpl:text-xs tpl:opacity-60 tpl:text-[var(--tpl-text-muted)]"
      >
        {{
          core.format(core.t.header.templatesUsed, {
            used: featureFlags.templateCount.value,
            max: featureFlags.templateLimit.value,
          })
        }}
      </span>
    </div>

    <!-- Center: viewport + preview + dark mode + collaboration + snapshots -->
    <div
      class="tpl-header-center tpl:flex tpl:items-center tpl:justify-center tpl:gap-10"
    >
      <ViewportToggle
        :viewport="editor.state.viewport"
        @change="editor.setViewport"
      />
      <DarkModeToggle
        :dark-mode="editor.state.darkMode"
        @change="editor.setDarkMode"
      />
      <PreviewToggle
        :preview-mode="editor.state.previewMode"
        @change="editor.setPreviewMode"
      />
      <CollaboratorBar
        v-if="collaboration && isCollaborationEnabled"
        :collaborators="collaboration.collaborators.value"
        :is-connected="websocket.isConnected.value"
      />
      <SnapshotHistory
        v-if="snapshotPreview.snapshotHistoryInstance.value"
        :snapshots="snapshotPreview.snapshotHistorySnapshots.value"
        :is-loading="snapshotPreview.snapshotHistoryIsLoading.value"
        :is-restoring="snapshotPreview.snapshotHistoryIsRestoring.value"
        @load="snapshotPreview.loadSnapshotHistory"
        @navigate="snapshotPreview.handleSnapshotNavigate"
      />
    </div>

    <!-- Right: Cloud actions -->
    <div
      class="tpl-header-right tpl:flex tpl:min-w-[200px] tpl:items-center tpl:justify-end tpl:gap-3"
    >
      <!-- Save status indicator -->
      <div
        v-if="featureFlags.saveStatus.value === 'error'"
        aria-live="assertive"
        class="tpl-tooltip tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-danger)]"
        :data-tooltip="featureFlags.saveErrorMessage.value"
      >
        <CircleAlert :size="12" :stroke-width="2.5" />
        {{ core.t.header.saveFailed }}
      </div>
      <div
        v-else-if="featureFlags.saveStatus.value === 'saved'"
        aria-live="polite"
        class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-success)]"
      >
        <Check :size="12" :stroke-width="2.5" />
        {{ core.t.header.saved }}
      </div>
      <div
        v-else-if="editor.state.isDirty"
        aria-live="polite"
        class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
      >
        <span
          class="tpl-pulse tpl:size-1.5 tpl:rounded-full tpl:bg-[var(--tpl-primary)]"
        ></span>
        {{ core.t.header.unsaved }}
      </div>

      <!-- Comments button -->
      <button
        v-if="
          commentsInstance.isEnabled.value &&
          featureFlags.hasTemplateSaved.value
        "
        :aria-label="
          commentsInstance.unresolvedCount.value > 0
            ? `${core.t.comments.button} (${commentsInstance.unresolvedCount.value})`
            : core.t.comments.button
        "
        :aria-expanded="panelState.commentsOpen.value"
        :class="headerBtnClass"
        :style="{
          backgroundColor: panelState.commentsOpen.value
            ? 'var(--tpl-primary)'
            : 'transparent',
          color: panelState.commentsOpen.value
            ? 'var(--tpl-bg)'
            : 'var(--tpl-primary)',
          borderColor: 'var(--tpl-primary)',
        }"
        @click="panelState.commentsOpen.value = !panelState.commentsOpen.value"
      >
        <MessageCircle :size="16" :stroke-width="2" />
        {{ core.t.comments.button }}
        <span
          v-if="
            commentsInstance.unresolvedCount.value > 0 &&
            !panelState.commentsOpen.value
          "
          class="tpl:inline-flex tpl:size-4.5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-bg)]"
        >
          {{ commentsInstance.unresolvedCount.value }}
        </span>
      </button>

      <!-- AI button + menu -->
      <div
        v-if="
          featureFlags.canUseAiGeneration.value &&
          featureFlags.hasTemplateSaved.value
        "
        :ref="(el) => (panelState.aiMenuRef.value = el as HTMLElement | null)"
        class="tpl:relative"
      >
        <button
          :aria-expanded="panelState.aiMenuOpen.value"
          class="tpl-ai-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:whitespace-nowrap tpl:transition-all tpl:duration-200"
          :class="
            panelState.aiButtonActive.value
              ? 'tpl-ai-btn--active'
              : 'tpl-ai-btn--idle'
          "
          @click.stop="panelState.toggleAiMenu"
        >
          <Sparkles :size="16" :stroke-width="2" class="tpl-ai-btn-icon" />
          {{ core.t.aiChat.button }}
        </button>
        <Transition
          enter-active-class="tpl:transition-all tpl:duration-150 tpl:ease-out"
          enter-from-class="tpl:scale-95 tpl:opacity-0"
          enter-to-class="tpl:scale-100 tpl:opacity-100"
          leave-active-class="tpl:transition-all tpl:duration-100 tpl:ease-in"
          leave-from-class="tpl:scale-100 tpl:opacity-100"
          leave-to-class="tpl:scale-95 tpl:opacity-0"
        >
          <div
            v-if="panelState.aiMenuOpen.value"
            class="tpl:absolute tpl:right-0 tpl:top-full tpl:z-50 tpl:mt-1 tpl:origin-top-right"
          >
            <AiFeatureMenu
              :active-feature="panelState.activeAiFeature.value"
              @select="panelState.handleAiFeatureSelect"
            />
          </div>
        </Transition>
      </div>

      <!-- Test email button -->
      <button
        v-if="testEmail.isEnabled.value && featureFlags.canSendTestEmail.value"
        :class="headerBtnClass"
        style="
          background-color: transparent;
          color: var(--tpl-primary);
          border-color: var(--tpl-primary);
        "
        :disabled="
          testEmail.isSending.value || !featureFlags.hasTemplateSaved.value
        "
        @click="panelState.testEmailModalOpen.value = true"
      >
        <Send v-if="!testEmail.isSending.value" :size="16" :stroke-width="2" />
        <LoaderCircle
          v-else
          class="tpl-spinner"
          :size="16"
          :stroke-width="2"
        />
        {{ core.t.testEmail.button }}
      </button>

      <!-- Save button -->
      <button
        :class="headerBtnClass"
        style="
          background-color: transparent;
          color: var(--tpl-primary);
          border-color: var(--tpl-primary);
        "
        :disabled="isSaveDisabled"
        @click="$emit('save')"
      >
        <Save v-if="!isSaving" :size="16" :stroke-width="2" />
        <LoaderCircle v-else class="tpl-spinner" :size="16" :stroke-width="2" />
        {{ isSaving ? core.t.header.saving : core.t.header.save }}
      </button>
    </div>
  </header>
</template>
