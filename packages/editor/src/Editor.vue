<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import type { TemplaticalEditorConfig } from "./index";
import { useEditor } from "@templatical/core";
import type { TemplateContent, UiTheme } from "@templatical/types";
// Type-only, so no cloud module is statically reachable from the OSS entry —
// see `cloud/runtime.ts` for why the seam is shaped this way.
import type { CloudRuntime } from "./cloud/runtime";
import { useEditorCore } from "./composables/useEditorCore";
import { useCommentsFeature } from "./composables/useCommentsFeature";
import { useSavedBlocksFeature } from "./composables/useSavedBlocksFeature";
import { useTemplatesFeature } from "./composables/useTemplatesFeature";
import { useTestEmailFeature } from "./composables/useTestEmailFeature";
import { useVersionHistoryFeature } from "./composables/useVersionHistoryFeature";
import { useSmallScreenNotice } from "./composables/useSmallScreenNotice";
import { resolveAutoSave } from "./types/auto-save";
import { resolveLintOptions } from "./utils/resolveLintOptions";
import { logger } from "./utils/logger";
import { toMjmlForInstance } from "./utils/toMjml";
import { resolveRenderFonts } from "./utils/renderProvider";
import {
  withNormalizedContentWrites,
  withNormalizedTemplateLoads,
} from "./utils/normalizeMergeTagMarkup";
import type { Translations } from "./i18n";
import type { EditorCapabilities } from "./types/editor-capabilities";
import type { UseFontsReturn } from "./composables/useFonts";

import { RotateCcw } from "@lucide/vue";
import Canvas from "./components/Canvas.vue";
import CustomBlockStylesheets from "./components/CustomBlockStylesheets.vue";
import Sidebar from "./components/Sidebar.vue";
import RightSidebar from "./components/RightSidebar.vue";
import SmallScreenNotice from "./components/SmallScreenNotice.vue";
import EditorFooter from "./components/EditorFooter.vue";
import EditorHeader from "./components/EditorHeader.vue";
import MergeTagPickerModal from "./components/MergeTagPickerModal.vue";
import LogicTagPickerModal from "./components/LogicTagPickerModal.vue";
import "./styles/index.css";

const props = defineProps<{
  config: TemplaticalEditorConfig;
  translations: Translations;
  fontsManager: UseFontsReturn;
  /**
   * Shadow root the editor is mounted into. Supplied by `init()` when
   * `shadowDom: true`; undefined in light-DOM mode. Passed through to
   * `useEditorCore` so shadow-DOM-aware composables can resolve the
   * effective root via `EDITOR_ROOT_KEY`.
   */
  shadowRoot?: ShadowRoot;
  /**
   * Cloud's adapter wiring, supplied only by `initCloud()`.
   *
   * There is **one** editor component. Cloud is a set of providers on
   * `config` plus this runtime, which exists purely for the handful of
   * composables that must run at a specific point inside this `setup()` —
   * collaboration before the history interceptor, the lint save-gate after
   * `useEditorCore`. Everything else it contributes arrives through the
   * ordinary config keys an OSS consumer would fill in themselves.
   */
  cloud?: CloudRuntime;
}>();

// The fourth place consumer content enters (the other three are the entry
// points in `index.ts`: the mount seed, `setContent` and `create`). A template
// fetched from the store never passes through the public API — core assigns it
// to state itself — so the provider is wrapped here, on its way in. Wrapping
// rather than normalizing after the load resolves is what keeps the load from
// registering as an edit: core is handed content that is already correct.
const templatesProvider = props.config.templates
  ? withNormalizedTemplateLoads(props.config.templates, props.config.mergeTags)
  : undefined;

// --- Core editor state ---
const editor = useEditor({
  content: props.config.content!,
  // Seeds a *new* template's body font when no `content` was supplied. Only the
  // deleted Cloud core passed this, so `init({ fonts: { defaultFont } })` never
  // reached a blank template.
  defaultFontFamily: props.config.fonts?.defaultFont,
  templateDefaults: props.config.templateDefaults,
  templates: templatesProvider,
  onError: props.config.onError,
  // Cloud's collaborators lock the blocks they are editing. The map is
  // forward-declared by the runtime because `useCollaboration` — which fills
  // it — can only be built after this call.
  lockedBlocks: props.cloud?.lockedBlocks,
});

// Collaboration wraps the editor's mutators so they broadcast; `useEditorCore`'s
// history interceptor wraps them again below. Reversing that order would push
// local history entries for remote operations and drift the peers apart, which
// is the whole reason this runs here rather than alongside the rest.
const cloudAttachment = props.cloud ? props.cloud.attach({ editor }) : null;

// --- Templates (opt-in: only when a storage provider is configured) ---
// Built before `useEditorCore` so its capability can be passed in, which is what
// lights up the header's name field, status indicator and save button — and what
// makes Cmd+S mean "persist now".
const templates = templatesProvider
  ? useTemplatesFeature({
      provider: templatesProvider,
      editor,
      guardUnsavedChanges: props.config.unsavedChangesGuard,
      // Cloud's lint save-gate, when there is one. Read through a getter
      // because the gate needs `core.templateLint`, which does not exist yet.
      // Without this the collapse would have silently dropped the server's
      // `accessibility.blockOnError` policy.
      getSaveGate: props.cloud ? () => props.cloud!.getSaveGate() : undefined,
    })
  : null;

// Reported to the consumer regardless of whether a provider is configured: a
// `beforeunload` guard cannot cover SPA route changes, so an embedder needs this
// to guard their own router — including when they persist via `onChange`.
if (props.config.onDirtyChange) {
  watch(
    () => editor.state.isDirty,
    (isDirty) => props.config.onDirtyChange!(isDirty),
  );
}

// Outer `.tpl` ref — passed to `useEditorCore` so the active-editor
// tracker can route keyboard shortcuts when two editors share a page.
const rootEl = ref<HTMLElement | null>(null);

// --- Saved blocks (opt-in: only when a storage provider is configured) ---
// Instantiated before `useEditorCore` so its capability can be passed in,
// which is what lights up the shared save button and sidebar rail.
const savedBlocks = props.config.savedBlocks
  ? useSavedBlocksFeature({
      provider: props.config.savedBlocks,
      editor,
      onError: props.config.onError,
      // Cloud's store is plan-gated; a consumer's own store never is.
      isAvailable: props.cloud
        ? () => props.cloud!.isSavedBlocksAvailable()
        : undefined,
    })
  : null;

// Lazily loaded so a consumer without a provider downloads none of the
// saved-blocks UI. Rendered only when the feature is active.
const SavedBlocksPanels = defineAsyncComponent(
  () => import("./components/SavedBlocksPanels.vue"),
);

// --- Test email (opt-in: only when a sending provider is configured) ---
// Created before `useEditorCore` so its capability can be passed in, same as
// saved blocks. `renderCurrentMjml` is a hoisted function declaration, so it can
// be referenced here and still read `core` — which is declared below — because
// it isn't called until the user sends.
const testEmail = props.config.testEmail
  ? useTestEmailFeature({
      provider: props.config.testEmail,
      getContent: () => editor.content.value,
      renderMjml: renderCurrentMjml,
      onError: props.config.onError,
      // Cloud folds in the plan feature and "the template must be saved", both
      // constraints of *its* sending path rather than of the contract.
      isAvailable: props.cloud
        ? () => props.cloud!.isTestEmailAvailable()
        : undefined,
    })
  : null;

const TestEmailPanel = defineAsyncComponent(
  () => import("./components/TestEmailPanel.vue"),
);

// --- Comments (opt-in: only with a storage provider *and* a `user`) ---
// Built before `useEditorCore` so its capability can be passed in, which is what
// lights up the header trigger and the per-block comment indicators.
//
// No `user` means no provider call at all — an unattributable comment is worse
// than no comment feature, so `isAvailable` stays false and nothing renders.
const comments = props.config.comments
  ? useCommentsFeature({
      provider: props.config.comments,
      editor,
      user: props.config.user,
      // Cloud keeps comments mutually exclusive with its AI and scoring sidebars:
      // they share one 360px gutter, and two of them open at once would overlap.
      isOpen: cloudAttachment?.panelState.commentsOpen,
      onComment: props.config.onComment,
      onError: props.config.onError,
      // Cloud folds in the `commenting` plan feature and "the template must be
      // saved", both constraints of *its* store rather than of the contract.
      isAvailable: props.cloud
        ? () => props.cloud!.isCommentsAvailable()
        : undefined,
      // Cloud anchors a comment to a block in the saved template; a consumer's
      // store accepts whatever anchor it is given.
      isBlockSaved: props.cloud
        ? (blockId: string) => props.cloud!.isBlockSaved(blockId)
        : undefined,
    })
  : null;

const CommentsPanel = defineAsyncComponent(
  () => import("./components/CommentsPanel.vue"),
);

// --- Cloud chrome (opt-in: only under `initCloud()`) ---
// One lazy wrapper for every panel, overlay and modal Cloud adds, plus one for
// its header controls. Same discipline as `SavedBlocksPanels` / `TestEmailPanel`:
// an OSS consumer never downloads any of it.
const CloudPanels = defineAsyncComponent(
  () => import("./cloud/components/CloudPanels.vue"),
);
const CloudHeaderExtras = defineAsyncComponent(
  () => import("./cloud/components/CloudHeaderExtras.vue"),
);

// --- Version history (opt-in: only when a storage provider is configured) ---
// The header control lives in `EditorHeader`; this is the preview banner, which
// renders outside the header. Both are lazy.
const VersionHistoryPanels = defineAsyncComponent(
  () => import("./components/VersionHistoryPanels.vue"),
);

// --- Auto-save ---
// One debounced tick drives everything a consumer can ask for on a content
// change: the `onChange` notification, and — when `autoSave` is on with a
// templates provider — the save itself. Sharing a single `useAutoSave` instance
// keeps the two in step and inherits the pause-during-undo/redo behaviour
// `useEditorCore` wires up around it.
const autoSaveConfig = resolveAutoSave(props.config.autoSave, false);
const isAutoSaving = autoSaveConfig.enabled && templates !== null;
if (autoSaveConfig.enabled && templates === null) {
  logger.warn(
    "config.autoSave is on but no `templates` provider is configured — " +
      "there is nothing to save to. Pass `templates` to enable it, or use " +
      "`onChange` to persist the content yourself.",
  );
}

const autoSaveOptions =
  props.config.onChange || isAutoSaving
    ? {
        onChange: () => {
          props.config.onChange?.(
            JSON.parse(JSON.stringify(editor.state.content)),
          );
          // `requestAutoSave()` already no-ops without a saveable template, so a
          // read-only provider costs one predicate per tick and nothing else.
          // It is the *ungated* request only in the sense that it never raises a
          // prompt: Cloud's lint gate still refuses it, which is what keeps
          // `accessibility.blockOnError` a policy rather than a manual-save
          // speed bump.
          if (isAutoSaving) templates!.requestAutoSave();
        },
        ...(autoSaveConfig.debounce !== undefined
          ? { debounce: autoSaveConfig.debounce }
          : {}),
      }
    : null;

// --- Shared editor core (composables, provides, plugins, keyboard) ---
// A named object rather than an inline literal: `useVersionHistoryFeature` can
// only be built after core (it needs history/conditionPreview/autoSave), so its
// capability is assigned in below, into the very object core provided.
const capabilities: EditorCapabilities = {
  ...(savedBlocks ? { savedBlocks: savedBlocks.capability } : {}),
  ...(templates ? { templates: templates.capability } : {}),
  ...(testEmail ? { testEmail: testEmail.capability } : {}),
  ...(comments ? { comments: comments.capability } : {}),
};

const core = useEditorCore({
  editor,
  containerEl: rootEl,
  config: {
    uiTheme: props.config.uiTheme,
    theme: props.config.theme,
    blockDefaults: props.config.blockDefaults,
    templateDefaults: props.config.templateDefaults,
    customBlocks: props.config.customBlocks,
    paletteBlocks: props.config.paletteBlocks,
    htmlBlockPreview: props.config.htmlBlockPreview,
    colors: props.config.colors,
    mergeTags: props.config.mergeTags,
    logicTags: props.config.logicTags,
    displayConditions: props.config.displayConditions,
    // Cloud swaps in its own media browser. Not plan-gated: an entitlement here
    // would fire when a consumer is *not* using Cloud storage, i.e. backwards.
    onRequestMedia: props.cloud?.onRequestMedia ?? props.config.onRequestMedia,
    resolvePreview: props.config.resolvePreview,
    resolveImageUrl: props.config.resolveImageUrl,
    lint: resolveLintOptions(props.config),
  },
  translations: props.translations,
  fontsManager: props.fontsManager,
  autoSaveOptions,
  capabilities,
  editorRoot: props.shadowRoot,
  historyOptions: props.cloud
    ? { isRemoteOperation: () => props.cloud!.isRemoteOperation() }
    : undefined,
  keyboardOptions: props.cloud
    ? { onBeforeUndo: () => props.cloud!.onBeforeUndo() }
    : undefined,
});

// Cloud's setup-time wiring that needs `core`: the lint save-gate (reads
// `core.templateLint`), the collab undo warning (reads `core.history.canUndo`),
// and the capability entries Cloud contributes — mutated into the very object
// `useEditorCore` provided, so injecting components see them on first render.
const cloudReady =
  props.cloud && cloudAttachment
    ? props.cloud.ready({ core, capabilities })
    : null;

// --- Version history (opt-in: only when a storage provider is configured) ---
// Constructed *after* `useEditorCore` because it drives `history` /
// `conditionPreview` / `autoSave`, which core owns. Its capability is therefore
// assigned into the object above rather than passed in — same object reference
// core provided, mutated during setup, so injecting components see it on their
// first render.
const versionHistory = props.config.versionHistory
  ? useVersionHistoryFeature({
      provider: props.config.versionHistory,
      // The fifth content-in path, and the one carrying the oldest content in
      // the product: a version written before merge-tag normalization shipped
      // still holds bare tokens, and previewing it would put them back on a
      // canvas where every other tag is a chip. Wrapped at `setContent` rather
      // than at the provider, because version content also arrives off the
      // hydrated list and out of the `fetched` cache without touching `get()`.
      editor: withNormalizedContentWrites(editor, props.config.mergeTags),
      history: core.history,
      conditionPreview: core.conditionPreview,
      autoSave: core.autoSave,
      // Lets the restore confirmation offer to persist unsaved work instead of
      // only warning about it. Without a templates provider — or with one whose
      // `save` is `false` — there is nowhere to put that work, and the
      // confirmation says so rather than offering an action that can't happen.
      // Cloud additionally refuses while the lint gate would block: stacking a
      // second modal on the confirmation would be worse than saying there is
      // currently nowhere to put the work.
      saveBeforeRestore: templates
        ? {
            canSave: () =>
              templates.canSave.value &&
              !(props.cloud?.getSaveGate()?.shouldBlock.value ?? false),
            save: () => templates.save(),
          }
        : null,
      onError: props.config.onError,
    })
  : null;

if (versionHistory) capabilities.versionHistory = versionHistory.capability;

/**
 * Render the current template to MJML for `testEmail`'s `includeMjml` option.
 *
 * Assembles the same three members `defineExpose` hands to the public instance,
 * so a test email carries byte-identical MJML to `editor.toMjml()`. Only reached
 * when a provider opted in; the dynamic renderer import inside
 * `toMjmlForInstance` means an OSS consumer who didn't opt in never loads it.
 */
function renderCurrentMjml(): Promise<string> {
  return toMjmlForInstance({
    getContent: () => editor.content.value,
    renderCustomBlock: core.registry.renderCustomBlock,
    getCustomBlockStylesheet: (customType: string) =>
      core.registry.getDefinition(customType)?.stylesheet,
    getFonts: () => resolveRenderFonts(props.fontsManager),
  });
}

/**
 * Left/right insets for the canvas body and the footer, which must always agree.
 *
 * Cloud's sidebars widen the right gutter when one is open; without a cloud
 * runtime `rightPanelOpen` is simply never true.
 */
/**
 * Whether a 360px feature panel occupies the right-hand gutter.
 *
 * The comments panel is the one an OSS session can open, so it counts on its own.
 * In Cloud it also drives `rightPanelOpen` (they share the panel state, which is
 * what keeps comments mutually exclusive with the AI and scoring sidebars), so the
 * `||` is redundant there and load-bearing here.
 *
 * Two things read this, and **both must**: the canvas/footer insets below, and
 * `RightSidebar`'s `shifted-left` — the properties panel sits at `right-0` too, so
 * a panel opening over it would swallow every click meant for the panel.
 */
const rightPanelOpen = computed(
  () =>
    comments?.isOpen.value === true ||
    cloudAttachment?.panelState.rightPanelOpen.value === true,
);

const bodyInsetClass = computed(() => {
  if (editor.state.previewMode) return "tpl:left-0 tpl:right-0";
  return rightPanelOpen.value
    ? "tpl:left-12 tpl:right-[680px]"
    : "tpl:left-12 tpl:right-[320px]";
});

/** Canvas affordances that open a Cloud panel. No-ops without a runtime. */
function openCloudPanel(panel: "ai-chat" | "design-reference"): void {
  if (!cloudAttachment) return;
  if (panel === "ai-chat") cloudAttachment.panelState.aiChatOpen.value = true;
  else cloudAttachment.panelState.designReferenceOpen.value = true;
}

// --- Small-screen gate (#235) ---
// Below ~768px the three-pane chrome can't lay out usably; show a notice
// instead. Opt out with `config.smallScreenNotice: false`.
const { showNotice: showSmallScreenNotice } = useSmallScreenNotice(
  () => props.config.smallScreenNotice,
);

// --- Lifecycle ---
onMounted(async () => {
  await props.fontsManager.loadCustomFonts();
});

onUnmounted(() => {
  props.fontsManager.cleanupFontLinks();
  props.cloud?.destroy();
  core.destroy();
});

// --- Public API (accessed via template ref from init()) ---
// The lifecycle trio comes from the templates feature when one exists, so a
// programmatic save also drives the header's status. Without a provider it comes
// straight from core, whose own methods reject with the actionable error.
const templateLifecycle = templates ?? editor;

defineExpose({
  getContent: () => editor.content.value,
  setContent: (content: TemplateContent) => editor.setContent(content),
  setTheme: (theme: UiTheme) => editor.setUiTheme(theme),
  isDirty: () => editor.state.isDirty,
  create: templateLifecycle.create,
  load: templateLifecycle.load,
  save: templateLifecycle.save,
  renderCustomBlock: core.registry.renderCustomBlock,
  getCustomBlockStylesheet: (customType: string) =>
    core.registry.getDefinition(customType)?.stylesheet,
});
</script>

<template>
  <!-- @dragover/@drop.prevent: a file dropped outside an image drop zone would
       otherwise make the browser navigate to the file:// URL and destroy the
       editor session. Image zones (useImageDrop) handle their own drops; this
       only neutralizes the default action everywhere else (#229). -->
  <div
    ref="rootEl"
    class="tpl tpl:relative tpl:h-full tpl:overflow-hidden"
    :class="{ 'tpl:dark': editor.state.darkMode }"
    :data-tpl-theme="core.resolvedTheme.value"
    :style="core.themeStyles.value"
    @dragover.prevent
    @drop.prevent
  >
    <!-- Reactive `<style>` tags for custom-block definition stylesheets in
         use. Sits at the top so its rules apply to the canvas below. -->
    <CustomBlockStylesheets />
    <!-- One header for both entry points. Cloud's own controls arrive through
         the three slots; everything else here is capability-gated, so the same
         markup covers "no providers at all" and a fully-wired Cloud session. -->
    <EditorHeader
      :editor="editor"
      :core="core"
      :templates="templates"
      :show-template-name="config.templateNameField !== false"
      :test-email="testEmail"
      :version-history="versionHistory"
      :comments="comments"
    >
      <template v-if="cloudAttachment" #left-extras>
        <CloudHeaderExtras part="left" :cloud="cloudAttachment" />
      </template>
      <template v-if="cloudAttachment" #center-extras>
        <CloudHeaderExtras part="center" :cloud="cloudAttachment" />
      </template>
      <template v-if="cloudAttachment" #right-extras>
        <CloudHeaderExtras part="right" :cloud="cloudAttachment" />
      </template>
    </EditorHeader>

    <!-- Left sidebar — absolute, below header -->
    <Sidebar v-show="!editor.state.previewMode" />

    <!-- Canvas area — absolute, fills remaining space -->
    <div
      class="tpl-body tpl:absolute tpl:bottom-0 tpl:overflow-auto tpl:bg-[var(--tpl-canvas-bg)]"
      style="transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)"
      :class="[
        bodyInsetClass,
        versionHistory?.isPreviewing.value ? 'tpl:top-[104px]' : 'tpl:top-14',
      ]"
    >
      <!-- Restore hidden blocks button -->
      <div class="tpl:sticky tpl:top-0 tpl:z-40 tpl:h-0">
        <Transition name="tpl-restore-btn">
          <button
            v-if="
              core.conditionPreview.hasHiddenBlocks.value &&
              core.appliesConditionFilter.value
            "
            class="tpl:absolute tpl:left-1/2 tpl:top-2 tpl:-translate-x-1/2 tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-full tpl:border tpl:px-3.5 tpl:py-1.5 tpl:text-xs tpl:font-medium tpl:whitespace-nowrap tpl:shadow-[var(--tpl-shadow-md)] tpl:hover:opacity-80 tpl:bg-[var(--tpl-warning-light)] tpl:text-[var(--tpl-warning)] tpl:border-[var(--tpl-warning)]"
            style="backdrop-filter: blur(8px)"
            data-testid="restore-hidden-blocks"
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
          :content="core.previewResolution.content.value"
          :selected-block-id="editor.state.selectedBlockId"
          :dark-mode="editor.state.darkMode"
          :preview-mode="editor.state.previewMode"
          :locked-blocks="cloudAttachment?.collaboration?.lockedBlocks.value"
          @select-block="editor.selectBlock"
          @open-ai-chat="openCloudPanel('ai-chat')"
          @open-design-reference="openCloudPanel('design-reference')"
        />
      </main>
    </div>

    <EditorFooter
      v-if="config.branding !== false"
      :position-class="[bodyInsetClass]"
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
      :shifted-left="rightPanelOpen"
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

    <!-- Popover mount — Teleport target for toolbars, link dialog, modal.
         Replaces the historical body-level teleport pattern so popups
         render inside the editor's effective DOM root (shadow-aware). -->
    <div
      :ref="(el) => (core.popoverRoot.value = el as HTMLElement | null)"
      class="tpl-popover-root"
    />

    <!-- Built-in merge tag picker modal. Reads picker state via injection;
         renders nothing until `picker.isOpen` flips true. -->
    <MergeTagPickerModal />

    <!-- Built-in logic picker modal (standalone logic feature). -->
    <LogicTagPickerModal />

    <!-- Saved blocks dialogs. Only mounted when a provider is configured;
         each dialog's chunk loads on first open. -->
    <SavedBlocksPanels
      v-if="savedBlocks?.isAvailable.value"
      :feature="savedBlocks"
    />

    <TestEmailPanel v-if="testEmail?.isAvailable.value" :feature="testEmail" />

    <!-- The comments sidebar. Only mounted when a provider and a `user` are
         configured; the sidebar's own chunk loads the first time it opens. -->
    <CommentsPanel v-if="comments?.isAvailable.value" :feature="comments" />

    <!-- Version-history chrome outside the header (the preview banner). Only
         mounted when a provider is configured; the banner's chunk loads the
         first time a version is previewed. -->
    <VersionHistoryPanels
      v-if="versionHistory?.isAvailable.value"
      :feature="versionHistory"
    />

    <!-- Cloud sidebars, modals and overlays. One lazy wrapper, mounted only
         under `initCloud()`; an OSS consumer downloads none of it. -->
    <CloudPanels
      v-if="cloud && cloudAttachment && cloudReady"
      :editor="editor"
      :core="core"
      :runtime="cloud"
      :cloud="cloudAttachment"
      :ready="cloudReady"
      :locale="config.locale"
    />

    <!-- Small-screen gate (#235). Last child + a literal z-index above the
         chrome and `.tpl-popover-root`, so the opaque notice covers everything
         below the breakpoint. -->
    <SmallScreenNotice v-if="showSmallScreenNotice" />
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
