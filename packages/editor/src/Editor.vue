<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
} from "vue";
import { useEventListener } from "@vueuse/core";
import type { TemplaticalEditorConfig } from "./index";
import {
  useEditor,
  useHistory,
  useBlockActions,
  useAutoSave,
  useConditionPreview,
} from "@templatical/core";
import type { EditorPlugin, EditorPluginContext } from "@templatical/core";
import type {
  TemplateContent,
  ThemeOverrides,
  UiTheme,
} from "@templatical/types";
import { resolveSyntax } from "@templatical/types";

import { RotateCcw } from "@lucide/vue";
import Canvas from "./components/Canvas.vue";
import Sidebar from "./components/Sidebar.vue";
import RightSidebar from "./components/RightSidebar.vue";
import ViewportToggle from "./components/ViewportToggle.vue";
import PreviewToggle from "./components/PreviewToggle.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import CustomBlockComponent from "./components/blocks/CustomBlock.vue";
import { loadTranslations } from "./i18n";
import { useBlockRegistry } from "./composables/useBlockRegistry";
import { useFonts } from "./composables/useFonts";
import { useUiTheme } from "./composables/useUiTheme";
import { useThemeStyles } from "./composables/useThemeStyles";
import "./styles/index.css";

const props = defineProps<{
  config: TemplaticalEditorConfig;
}>();

// --- i18n ---
const translations = shallowRef<Record<string, unknown> | null>(null);
const isReady = ref(false);

async function initTranslations(): Promise<void> {
  translations.value = await loadTranslations(props.config.locale ?? "en");
}

function t(key: string, params?: Record<string, string>): string {
  let value: unknown = translations.value;
  for (const segment of key.split(".")) {
    if (value && typeof value === "object") {
      value = (value as Record<string, unknown>)[segment];
    } else {
      value = undefined;
      break;
    }
  }
  let result = typeof value === "string" ? value : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(`{${k}}`, v);
    }
  }
  return result;
}

// --- Font management ---
const fontsManager = useFonts(props.config.fonts);

// --- Core editor state ---
const editor = useEditor({
  content: props.config.content!,
  templateDefaults: props.config.templateDefaults,
});

// --- History (undo/redo) ---
const history = useHistory({
  content: editor.content,
  setContent: editor.setContent,
});

// Wrap editor mutation methods to record history snapshots
const originalAddBlock = editor.addBlock;
const originalRemoveBlock = editor.removeBlock;
const originalMoveBlock = editor.moveBlock;
const originalUpdateBlock = editor.updateBlock;
const originalUpdateSettings = editor.updateSettings;

editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
  history.record();
  originalAddBlock(block, targetSectionId, columnIndex, index);
};

editor.removeBlock = (blockId) => {
  history.record();
  originalRemoveBlock(blockId);
};

editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
  history.record();
  originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
};

editor.updateBlock = (blockId, updates) => {
  history.recordDebounced(blockId);
  originalUpdateBlock(blockId, updates);
};

editor.updateSettings = (updates) => {
  history.record();
  originalUpdateSettings(updates);
};

// --- Block actions ---
const blockActions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
  blockDefaults: props.config.blockDefaults,
});

// --- Auto-save (debounced onChange for OSS mode) ---
const autoSave = props.config.onChange
  ? useAutoSave({
      content: editor.content,
      isDirty: () => editor.state.isDirty,
      onChange: props.config.onChange,
    })
  : null;

// --- Display condition preview ---
const conditionPreview = useConditionPreview(editor);

// --- UI Theme ---
editor.setUiTheme(props.config.uiTheme ?? "auto");
const uiThemeRef = computed(() => editor.state.uiTheme);
const { resolvedTheme } = useUiTheme(uiThemeRef);

// --- Theme ---
const themeOverrides = ref<ThemeOverrides>(props.config.theme ?? {});
const { themeStyles } = useThemeStyles({
  themeOverrides,
  resolvedTheme,
});

// --- Keyboard shortcuts ---
function handleKeyboard(e: KeyboardEvent): void {
  const isCmd = e.metaKey || e.ctrlKey;

  if (isCmd && e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    history.undo();
  }

  if (isCmd && e.key === "z" && e.shiftKey) {
    e.preventDefault();
    history.redo();
  }

  if (isCmd && e.key === "s") {
    e.preventDefault();
    props.config.onSave?.(JSON.parse(JSON.stringify(editor.state.content)));
  }

  if (e.key === "Escape") {
    editor.selectBlock(null);
  }

  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    editor.state.selectedBlockId &&
    !isEditingText(e)
  ) {
    e.preventDefault();
    history.record();
    editor.removeBlock(editor.state.selectedBlockId);
  }
}

function isEditingText(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

// --- Plugin system ---
const installedPlugins: EditorPlugin[] = [];

function installPlugins(): void {
  const plugins = props.config.plugins ?? [];
  const context: EditorPluginContext = {
    state: editor.state,
    content: editor.content,
    selectedBlockId: editor.state.selectedBlockId,
    viewport: editor.state.viewport,
    addBlock: editor.addBlock,
    updateBlock: editor.updateBlock,
    removeBlock: editor.removeBlock,
    moveBlock: editor.moveBlock,
    updateSettings: editor.updateSettings,
    selectBlock: editor.selectBlock,
    registerToolbarAction: () => {},
    registerSidebarPanel: () => {},
    registerBlockAction: () => {},
  };

  for (const plugin of plugins) {
    plugin.install(context);
    installedPlugins.push(plugin);
  }
}

// --- Provide to child components ---
provide("editor", editor);
provide("history", history);
provide("blockActions", blockActions);
provide("conditionPreview", conditionPreview);
provide("config", props.config);
provide("t", t);
provide("translations", translations);
provide("fontsManager", fontsManager);
provide("themeStyles", themeStyles);
provide("tplUiTheme", resolvedTheme);
provide("blockDefaults", props.config.blockDefaults);

// Block registry — register custom blocks from config
const registry = useBlockRegistry();
if (props.config.customBlocks?.length) {
  for (const definition of props.config.customBlocks) {
    registry.registerCustom(definition, CustomBlockComponent);
  }
}
provide("blockRegistry", registry);
provide("customBlockDefinitions", props.config.customBlocks ?? []);

// Merge tags
const mergeTagSyntax = resolveSyntax(props.config.mergeTags?.syntax);
provide("mergeTags", props.config.mergeTags?.tags ?? []);
provide("mergeTagSyntax", mergeTagSyntax);
provide("onRequestMergeTag", props.config.mergeTags?.onRequest ?? null);

// Media
provide("onRequestMedia", props.config.onRequestMedia ?? null);

// Display conditions
provide("displayConditions", props.config.displayConditions?.conditions ?? []);
provide(
  "allowCustomConditions",
  props.config.displayConditions?.allowCustom ?? false,
);

// --- Lifecycle ---
useEventListener(document, "keydown", handleKeyboard);

onMounted(async () => {
  await initTranslations();
  isReady.value = true;
  installPlugins();

  // Load custom fonts
  await fontsManager.loadCustomFonts();
});

onUnmounted(() => {
  autoSave?.destroy();
  history.destroy();
  for (const plugin of installedPlugins) {
    plugin.destroy?.();
  }
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
    :data-tpl-theme="resolvedTheme"
    :style="themeStyles"
  >
    <!-- Wait for translations to load before rendering UI -->
    <template v-if="!isReady">
      <div
        class="tpl:flex tpl:h-full tpl:items-center tpl:justify-center"
        style="background-color: var(--tpl-bg)"
      >
        <span class="tpl:text-sm" style="color: var(--tpl-text-muted)"
          >Loading...</span
        >
      </div>
    </template>
    <template v-else>
      <!-- Header — absolute, full width, above everything -->
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
        <!-- Left: Logo -->
        <div class="tpl:flex tpl:items-center tpl:gap-2.5">
          <img
            width="24"
            height="24"
            src="https://templatical.com/logo.svg"
            alt="Templatical"
          />
          <span
            class="tpl:text-sm tpl:font-semibold"
            style="color: var(--tpl-text); letter-spacing: -0.01em"
          >
            {{ t("header.title") }}
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
        class="tpl-body tpl:absolute tpl:bottom-0 tpl:overflow-auto tpl:transition-all tpl:duration-300"
        style="
          transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          background-color: var(--tpl-canvas-bg);
        "
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
              v-if="conditionPreview.hasHiddenBlocks.value"
              class="tpl:absolute tpl:left-1/2 tpl:top-2 tpl:-translate-x-1/2 tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-full tpl:border tpl:px-3.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:whitespace-nowrap tpl:shadow-md tpl:hover:opacity-80"
              style="
                background-color: var(--tpl-warning-light);
                color: var(--tpl-warning);
                border-color: var(--tpl-warning);
                backdrop-filter: blur(8px);
              "
              @click="conditionPreview.reset()"
            >
              <RotateCcw :size="13" :stroke-width="2" />
              {{ t("blockSettings.restoreHiddenBlocks") }}
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

      <!-- Footer — OSS branding (not shown in CloudEditor) -->
      <footer
        class="tpl:pointer-events-none tpl:absolute tpl:bottom-0 tpl:z-50 tpl:flex tpl:h-8 tpl:items-center tpl:justify-end tpl:pr-4 tpl:text-[9px] tpl:opacity-90 tpl:transition-all tpl:duration-300"
        :class="[
          editor.state.previewMode
            ? 'tpl:left-0 tpl:right-0'
            : 'tpl:left-12 tpl:right-[320px]',
        ]"
        style="color: var(--tpl-text-dim)"
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
          <span>{{ t("footer.poweredBy") }}</span>
          <a
            href="https://templatical.com"
            target="_blank"
            rel="noopener noreferrer"
            class="tpl:inline-flex tpl:items-center tpl:gap-1 tpl:font-medium tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80"
            style="color: var(--tpl-text-muted); text-decoration: none"
          >
            <img
              width="14"
              height="14"
              src="https://templatical.com/logo.svg"
              alt=""
            />
            Templatical
          </a>
          <span style="color: var(--tpl-border)">·</span>
          <a
            href="https://github.com/templatical/sdk"
            target="_blank"
            rel="noopener noreferrer"
            class="tpl:transition-colors tpl:duration-150 hover:tpl:opacity-80"
            style="color: var(--tpl-text-dim); text-decoration: none"
          >
            {{ t("footer.openSource") }}
          </a>
        </div>
      </footer>

      <!-- Right sidebar — absolute, below header -->
      <RightSidebar
        v-if="!editor.state.previewMode"
        :selected-block="editor.selectedBlock.value"
        :settings="editor.content.value.settings"
        @update-block="
          (updates) =>
            editor.updateBlock(editor.state.selectedBlockId!, updates)
        "
        @delete-block="
          () => {
            if (editor.state.selectedBlockId) {
              history.record();
              blockActions.deleteBlock(editor.state.selectedBlockId);
            }
          }
        "
        @duplicate-block="
          () => {
            if (editor.selectedBlock.value) {
              history.record();
              blockActions.duplicateBlock(editor.selectedBlock.value);
            }
          }
        "
        @update-settings="(updates) => editor.updateSettings(updates)"
      />
    </template>
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
