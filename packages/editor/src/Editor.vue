<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import type { TemplaticalEditorConfig } from "./index";
import { useEditor } from "@templatical/core";
import type { TemplateContent, UiTheme } from "@templatical/types";
import { useEditorCore } from "./composables/useEditorCore";
import type { Translations } from "./i18n";
import type { UseFontsReturn } from "./composables/useFonts";

import { RotateCcw } from "@lucide/vue";
import Canvas from "./components/Canvas.vue";
import Sidebar from "./components/Sidebar.vue";
import RightSidebar from "./components/RightSidebar.vue";
import ViewportToggle from "./components/ViewportToggle.vue";
import PreviewToggle from "./components/PreviewToggle.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import "./styles/index.css";

const props = defineProps<{
  config: TemplaticalEditorConfig;
  translations: Translations;
  fontsManager: UseFontsReturn;
}>();

// --- Core editor state ---
const editor = useEditor({
  content: props.config.content!,
  templateDefaults: props.config.templateDefaults,
});

// --- Shared editor core (composables, provides, plugins, keyboard) ---
const core = useEditorCore({
  editor,
  config: {
    uiTheme: props.config.uiTheme,
    theme: props.config.theme,
    blockDefaults: props.config.blockDefaults,
    customBlocks: props.config.customBlocks,
    mergeTags: props.config.mergeTags,
    displayConditions: props.config.displayConditions,
    onRequestMedia: props.config.onRequestMedia,
    onSave: props.config.onSave
      ? () =>
          props.config.onSave!(JSON.parse(JSON.stringify(editor.state.content)))
      : undefined,
  },
  translations: props.translations,
  fontsManager: props.fontsManager,
  autoSaveOptions: props.config.onChange
    ? {
        onChange: () =>
          props.config.onChange!(
            JSON.parse(JSON.stringify(editor.state.content)),
          ),
      }
    : null,
});

// --- Lifecycle ---
onMounted(async () => {
  await props.fontsManager.loadCustomFonts();
});

onUnmounted(() => {
  props.fontsManager.cleanupFontLinks();
  core.destroy();
});

// --- Public API (accessed via template ref from init()) ---
defineExpose({
  getContent: () => editor.content.value,
  setContent: (content: TemplateContent) => editor.setContent(content),
  setTheme: (theme: UiTheme) => editor.setUiTheme(theme),
});
</script>

<template>
  <div
    class="tpl tpl:relative tpl:h-full tpl:overflow-hidden"
    :class="{ 'tpl:dark': editor.state.darkMode }"
    :data-tpl-theme="core.resolvedTheme.value"
    :style="core.themeStyles.value"
  >
    <!-- Header — absolute, full width, above everything -->
    <header
      class="tpl-header tpl:absolute tpl:top-0 tpl:right-0 tpl:left-0 tpl:z-50 tpl:grid tpl:h-14 tpl:grid-cols-[1fr_auto_1fr] tpl:items-center tpl:px-4 tpl:shadow-[var(--tpl-shadow-md)] tpl:border-b tpl:border-[var(--tpl-border)]"
      style="
        background-color: color-mix(in srgb, var(--tpl-bg) 80%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      "
    >
      <!-- Left: Logo -->
      <div class="tpl:flex tpl:items-center tpl:gap-2.5">
        <img
          width="24"
          height="24"
          src="https://templatical.com/logo.svg"
          alt="Templatical"
        />
        <span
          class="tpl:text-sm tpl:font-semibold tpl:text-[var(--tpl-text)]"
          style="letter-spacing: -0.01em"
        >
          {{ core.t.header.title }}
        </span>
      </div>

      <!-- Center: viewport + preview + dark mode -->
      <div class="tpl:flex tpl:items-center tpl:justify-center tpl:gap-10">
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
      </div>

      <!-- Right: empty in OSS mode -->
      <div
        class="tpl:flex tpl:min-w-[200px] tpl:items-center tpl:justify-end tpl:gap-3"
      ></div>
    </header>

    <!-- Left sidebar — absolute, below header -->
    <Sidebar v-show="!editor.state.previewMode" />

    <!-- Canvas area — absolute, fills remaining space -->
    <div
      class="tpl-body tpl:absolute tpl:bottom-0 tpl:overflow-auto tpl:transition-all tpl:duration-300 tpl:bg-[var(--tpl-canvas-bg)]"
      style="transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1)"
      :class="[
        editor.state.previewMode
          ? 'tpl:left-0 tpl:right-0'
          : 'tpl:left-12 tpl:right-[320px]',
        'tpl:top-14',
      ]"
    >
      <!-- Restore hidden blocks button -->
      <div class="tpl:sticky tpl:top-0 tpl:z-40 tpl:h-0">
        <Transition name="tpl-restore-btn">
          <button
            v-if="core.conditionPreview.hasHiddenBlocks.value"
            class="tpl:absolute tpl:left-1/2 tpl:top-2 tpl:-translate-x-1/2 tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-full tpl:border tpl:px-3.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:whitespace-nowrap tpl:shadow-md tpl:hover:opacity-80 tpl:bg-[var(--tpl-warning-light)] tpl:text-[var(--tpl-warning)] tpl:border-[var(--tpl-warning)]"
            style="backdrop-filter: blur(8px)"
            @click="core.conditionPreview.reset()"
          >
            <RotateCcw :size="13" :stroke-width="2" />
            {{ core.t.blockSettings.restoreHiddenBlocks }}
          </button>
        </Transition>
      </div>
      <div class="tpl:flex tpl:justify-center tpl:p-8">
        <Canvas
          :viewport="editor.state.viewport"
          :content="editor.content.value"
          :selected-block-id="editor.state.selectedBlockId"
          :dark-mode="editor.state.darkMode"
          :preview-mode="editor.state.previewMode"
          @select-block="editor.selectBlock"
        />
      </div>
    </div>

    <!-- Footer — OSS branding -->
    <footer
      class="tpl:pointer-events-none tpl:absolute tpl:bottom-0 tpl:z-50 tpl:flex tpl:h-8 tpl:items-center tpl:justify-end tpl:pr-4 tpl:text-[9px] tpl:opacity-90 tpl:transition-all tpl:duration-300 tpl:text-[var(--tpl-text-dim)]"
      :class="[
        editor.state.previewMode
          ? 'tpl:left-0 tpl:right-0'
          : 'tpl:left-12 tpl:right-[320px]',
      ]"
    >
      <div
        class="tpl:pointer-events-auto tpl:flex tpl:items-center tpl:gap-1.5 tpl:rounded-tl-lg tpl:p-1"
        style="
          background-color: color-mix(
            in srgb,
            var(--tpl-canvas-bg) 85%,
            transparent
          );
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        "
      >
        <span>{{ core.t.footer.poweredBy }}</span>
        <a
          href="https://templatical.com"
          target="_blank"
          rel="noopener noreferrer"
          class="tpl:inline-flex tpl:items-center tpl:gap-1 tpl:font-medium tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80 tpl:text-[var(--tpl-text-muted)]"
          style="text-decoration: none"
        >
          <img
            width="14"
            height="14"
            src="https://templatical.com/logo.svg"
            alt=""
          />
          Templatical
        </a>
        <span class="tpl:text-[var(--tpl-border)]">·</span>
        <a
          href="https://github.com/templatical/sdk"
          target="_blank"
          rel="noopener noreferrer"
          class="tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80 tpl:text-[var(--tpl-text-dim)]"
          style="text-decoration: none"
        >
          {{ core.t.footer.openSource }}
        </a>
      </div>
    </footer>

    <!-- Right sidebar — persisted with v-show -->
    <RightSidebar
      v-show="!editor.state.previewMode"
      :selected-block="editor.selectedBlock.value"
      :settings="editor.content.value.settings"
      @update-block="
        (updates) => editor.updateBlock(editor.state.selectedBlockId!, updates)
      "
      @delete-block="
        () => {
          if (editor.state.selectedBlockId) {
            core.blockActions.deleteBlock(editor.state.selectedBlockId);
          }
        }
      "
      @duplicate-block="
        () => {
          if (editor.selectedBlock.value) {
            core.blockActions.duplicateBlock(editor.selectedBlock.value);
          }
        }
      "
      @update-settings="(updates) => editor.updateSettings(updates)"
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
