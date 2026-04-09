<script setup lang="ts">
import type {
  Block,
  CollaborationConfig,
  CommentEvent,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  McpConfig,
  MergeTagsConfig,
  SaveResult,
  Template,
  TemplateContent,
  ThemeOverrides,
  UiTheme,
} from "@templatical/types";
import type {
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";
import { cloneBlock, isCustomBlock } from "@templatical/types";
import type { CustomBlock } from "@templatical/types";
import type { EditorPlugin } from "@templatical/core";
import {
  AuthManager,
  performHealthCheck,
  resolveWebSocketConfig,
  useAiConfig,
  useCollaboration,
  useCollaborationBroadcast,
  useCommentListener,
  useComments,
  useEditor,
  useExport,
  useMcpListener,
  usePlanConfig,
  useSavedModules,
  useTemplateScoring,
  useTestEmail,
  useWebSocket,
  type UseCollaborationReturn,
} from "@templatical/core/cloud";
import type { UseFontsReturn } from "../composables/useFonts";
import type { McpOperationPayload } from "@templatical/types";
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from "vue";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from "@lucide/vue";
import type { Translations } from "../i18n";

import { useEditorCore } from "../composables/useEditorCore";
import type { EditorCapabilities } from "../types/editor-capabilities";
import {
  ON_REQUEST_MEDIA_KEY,
  AUTH_MANAGER_KEY,
  AI_CONFIG_KEY,
  COMMENTS_KEY,
  SAVED_MODULES_HEADLESS_KEY,
  SCORING_KEY,
  CAPABILITIES_KEY,
} from "../keys";
import type { UseSnapshotPreviewReturn } from "./composables/useSnapshotPreview";
import { useSnapshotPreview } from "./composables/useSnapshotPreview";
import { useCloudPanelState } from "./composables/useCloudPanelState";
import { useCollabUndoWarning } from "./composables/useCollabUndoWarning";
import { useCloudFeatureFlags } from "./composables/useCloudFeatureFlags";
import { useCloudMediaLibrary } from "./composables/useCloudMediaLibrary";
import { useVisualSavedModules } from "./composables/useSavedModules";
import { useDragDrop } from "../composables/useDragDrop";
import { DEFAULT_AUTO_SAVE_DEBOUNCE_MS } from "../constants/timeouts";
import { headerBtnClass } from "../constants/styleConstants";

import Canvas from "../components/Canvas.vue";
import Sidebar from "../components/Sidebar.vue";
import RightSidebar from "../components/RightSidebar.vue";
import ViewportToggle from "../components/ViewportToggle.vue";
import PreviewToggle from "../components/PreviewToggle.vue";
import DarkModeToggle from "../components/DarkModeToggle.vue";
import CloudLoadingOverlay from "./components/CloudLoadingOverlay.vue";
import CloudErrorOverlay from "./components/CloudErrorOverlay.vue";
import SnapshotPreviewBanner from "./components/SnapshotPreviewBanner.vue";
import CollabUndoToast from "./components/CollabUndoToast.vue";
import "../styles/index.css";

// Cloud async components
const AiChatSidebar = defineAsyncComponent(
  () => import("./components/AiChatSidebar.vue"),
);
const CommentsSidebar = defineAsyncComponent(
  () => import("./components/CommentsSidebar.vue"),
);
const DesignReferenceSidebar = defineAsyncComponent(
  () => import("./components/DesignReferenceSidebar.vue"),
);
const TemplateScoringPanel = defineAsyncComponent(
  () => import("./components/TemplateScoringPanel.vue"),
);
const TestEmailModal = defineAsyncComponent(
  () => import("./components/TestEmailModal.vue"),
);
const SaveModuleDialog = defineAsyncComponent(
  () => import("./components/SaveModuleDialog.vue"),
);
const ModuleBrowserModal = defineAsyncComponent(
  () => import("./components/ModuleBrowserModal.vue"),
);
const SnapshotHistory = defineAsyncComponent(
  () => import("./components/SnapshotHistory.vue"),
);
const CollaboratorBar = defineAsyncComponent(
  () => import("./components/CollaboratorBar.vue"),
);
const AiFeatureMenu = defineAsyncComponent(
  () => import("./components/AiFeatureMenu.vue"),
);
const MediaLibraryModal = defineAsyncComponent(async () => {
  const m = await import("@templatical/media-library");
  return m.MediaLibraryModal;
});

// ---------------------------------------------------------------------------
// Config type — flat cloud config extending OSS
// ---------------------------------------------------------------------------

export interface TemplaticalCloudEditorConfig {
  container: string | HTMLElement;
  content?: TemplateContent;

  auth: {
    url: string;
    baseUrl?: string;
    requestOptions?: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      credentials?: RequestCredentials;
    };
  };

  theme?: ThemeOverrides;
  uiTheme?: UiTheme;
  locale?: string;

  ai?: import("@templatical/types").AiConfig | false;
  commenting?: boolean;
  collaboration?: CollaborationConfig;
  mcp?: McpConfig;
  blockDefaults?: import("@templatical/types").BlockDefaults;
  templateDefaults?: import("@templatical/types").TemplateDefaults;

  modules?: boolean;
  autoSave?: boolean;
  autoSaveDebounce?: number;

  mergeTags?: MergeTagsConfig;
  displayConditions?: DisplayConditionsConfig;
  customBlocks?: CustomBlockDefinition[];
  fonts?: FontsConfig;
  plugins?: EditorPlugin[];

  onChange?: (content: TemplateContent) => void;
  onSave?: (result: SaveResult) => void;
  onCreate?: (template: Template) => void;
  onLoad?: (template: Template) => void;
  onError?: (error: Error) => void;
  onComment?: (event: CommentEvent) => void;
  onUnmount?: () => void;

  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  onBeforeTestEmail?: (html: string) => string | Promise<string>;
}

const props = defineProps<{
  config: TemplaticalCloudEditorConfig;
  translations: Translations;
  fontsManager: UseFontsReturn;
}>();
const emit = defineEmits<{
  (e: "ready"): void;
}>();

// ---------------------------------------------------------------------------
// Cloud initialization state
// ---------------------------------------------------------------------------

const isInitializing = ref(true);
const isAuthReady = ref(false);
const initError = ref<Error | null>(null);

// Tracks whether the component has been unmounted. Checked after every await
// in async lifecycle functions to prevent post-unmount side effects.
let _destroyed = false;

// ---------------------------------------------------------------------------
// 1. AuthManager + PlanConfig (infrastructure)
// ---------------------------------------------------------------------------

const authManager = new AuthManager({
  ...props.config.auth,
  onError: props.config.onError,
});

const planConfigInstance = usePlanConfig({
  authManager,
  onError: props.config.onError,
});

// ---------------------------------------------------------------------------
// 2. Collaboration locked blocks ref
// ---------------------------------------------------------------------------

const collaborationLockedBlocks = ref<Map<string, unknown>>(new Map());

// ---------------------------------------------------------------------------
// 3. Cloud editor (API-backed)
// ---------------------------------------------------------------------------

const editor = useEditor({
  authManager,
  defaultFontFamily: props.config.fonts?.defaultFont,
  templateDefaults: props.config.templateDefaults,
  onError: props.config.onError,
  lockedBlocks: collaborationLockedBlocks,
});

// ---------------------------------------------------------------------------
// 4. WebSocket + MCP listener
// ---------------------------------------------------------------------------

const websocket = useWebSocket({
  authManager,
  onError: props.config.onError,
});

if (props.config.mcp?.enabled) {
  useMcpListener({
    editor,
    channel: websocket.channel,
    onOperation: props.config.mcp.onOperation,
  });
}

// ---------------------------------------------------------------------------
// 5. Collaboration — MUST be before useEditorCore so broadcast wraps
//    editor methods first, then useHistoryInterceptor wraps AFTER
// ---------------------------------------------------------------------------

let collaboration:
  | (UseCollaborationReturn & {
      _broadcastOperation: (payload: McpOperationPayload) => void;
      _isProcessingRemoteOperation: () => boolean;
    })
  | null = null;

if (props.config.collaboration?.enabled) {
  collaboration = useCollaboration({
    authManager,
    editor,
    channel: websocket.channel,
    onError: props.config.onError,
    onCollaboratorJoined: props.config.collaboration.onCollaboratorJoined,
    onCollaboratorLeft: props.config.collaboration.onCollaboratorLeft,
    onBlockLocked: props.config.collaboration.onBlockLocked,
    onBlockUnlocked: props.config.collaboration.onBlockUnlocked,
  });

  // Sync locked blocks from collaboration to editor
  watch(
    () => collaboration!.lockedBlocks.value,
    (newLockedBlocks) => {
      collaborationLockedBlocks.value = newLockedBlocks;
    },
    { immediate: true },
  );

  // Wrap editor methods to broadcast operations to peers
  useCollaborationBroadcast(editor, collaboration);
}

const isCollaborationEnabled = computed(
  () =>
    !!props.config.collaboration?.enabled &&
    planConfigInstance.hasFeature("collaboration"),
);

// ---------------------------------------------------------------------------
// 6. useEditorCore — shared composables, provides, plugins, keyboard
// ---------------------------------------------------------------------------

// Forward references for circular dependencies resolved after setup
let snapshotPreviewRef: UseSnapshotPreviewReturn | null = null;
let collabWarningRef: ReturnType<typeof useCollabUndoWarning> | null = null;

const core = useEditorCore({
  editor,
  config: {
    uiTheme: props.config.uiTheme,
    theme: undefined, // Cloud applies theme in initialize() after plan check
    blockDefaults: props.config.blockDefaults,
    customBlocks: [], // Cloud defers registration to initialize()
    mergeTags: props.config.mergeTags,
    displayConditions: props.config.displayConditions,
    onRequestMedia: null, // Cloud uses handleRequestMedia via media library composable
    onSave: () => {
      saveTemplate().catch((err) => {
        props.config.onError?.(err as Error);
      });
    },
    plugins: props.config.plugins,
  },
  translations: props.translations,
  fontsManager: props.fontsManager,
  historyOptions: collaboration
    ? { isRemoteOperation: () => collaboration!._isProcessingRemoteOperation() }
    : undefined,
  autoSaveOptions: {
    onChange: async () => {
      if (editor.hasTemplate()) {
        await editor.createSnapshot();
        snapshotPreviewRef?.snapshotHistoryInstance.value?.loadSnapshots();
      }
    },
    debounce: props.config.autoSaveDebounce ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
    enabled: () =>
      props.config.autoSave !== false &&
      planConfigInstance.hasFeature("auto_save"),
  },
  themeExtraStyles: () => ({
    "--tpl-drop-text": `"${props.translations.canvas.dropHere}"`,
  }),
  keyboardOptions: {
    onBeforeUndo: () => collabWarningRef?.showCollabUndoWarning(),
  },
});

// ---------------------------------------------------------------------------
// 7. Collab undo warning (created after core so it can use core.history.canUndo)
// ---------------------------------------------------------------------------

const collabWarning = useCollabUndoWarning({
  isCollaborationEnabled,
  getCollaboratorCount: () => collaboration?.collaborators.value.length ?? 0,
  canUndo: core.history.canUndo,
});
collabWarningRef = collabWarning;

// ---------------------------------------------------------------------------
// 8. Snapshot preview (needs core.autoSave for pause/resume)
// ---------------------------------------------------------------------------

const snapshotPreview = useSnapshotPreview({
  authManager,
  editor,
  history: core.history,
  conditionPreview: core.conditionPreview,
  autoSave: core.autoSave,
  onError: props.config.onError,
});

// Connect forward reference for autoSave onChange
snapshotPreviewRef = snapshotPreview;

// ---------------------------------------------------------------------------
// 9. Remaining cloud composables
// ---------------------------------------------------------------------------

const panelState = useCloudPanelState();

const aiConfig = useAiConfig(props.config.ai);

const featureFlags = useCloudFeatureFlags({
  planConfigInstance,
  aiConfig,
  editor,
});

const mediaLib = useCloudMediaLibrary({
  onRequestMedia: props.config.onRequestMedia,
  mediaLibraryOpen: panelState.mediaLibraryOpen,
  mediaLibraryAccept: panelState.mediaLibraryAccept,
});

const dragDrop = useDragDrop({
  onBlockMove: editor.moveBlock,
  onBlockAdd: editor.addBlock,
});

const exporter = useExport({
  authManager,
  getFontsConfig: () => props.config.fonts,
  canUseCustomFonts: () => planConfigInstance.hasFeature("custom_fonts"),
});

const testEmail = useTestEmail({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
  save: () => editor.save(),
  exportHtml: (templateId: string) => exporter.exportHtml(templateId),
  onError: props.config.onError,
  isAuthReady,
  onBeforeTestEmail: props.config.onBeforeTestEmail,
});

const commentsInstance = useComments({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
  getSocketId: () => websocket.getSocketId(),
  onComment: props.config.onComment,
  onError: props.config.onError,
  isAuthReady,
  hasCommentingFeature: () =>
    props.config.commenting !== false &&
    planConfigInstance.hasFeature("commenting"),
});

useCommentListener({
  comments: commentsInstance,
  channel: websocket.channel,
});

const savedModulesHeadless = useSavedModules({
  authManager,
  onError: props.config.onError,
});
const savedModulesVisual = useVisualSavedModules(savedModulesHeadless);

const scoringInstance = useTemplateScoring({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
});

// ---------------------------------------------------------------------------
// 10. Cloud-only provides
// ---------------------------------------------------------------------------

provide(ON_REQUEST_MEDIA_KEY, mediaLib.handleRequestMedia);
provide(AUTH_MANAGER_KEY, authManager);
provide(AI_CONFIG_KEY, aiConfig);
provide(COMMENTS_KEY, commentsInstance);
provide(SAVED_MODULES_HEADLESS_KEY, savedModulesHeadless);
provide(SCORING_KEY, scoringInstance);

// Override the default empty capabilities from useEditorCore with cloud capabilities.
// OSS components use this single inject instead of individual cloud injects.
provide(CAPABILITIES_KEY, {
  plan: planConfigInstance,
  ai: aiConfig,
  comments: {
    getBlockCount: (blockId: string) =>
      commentsInstance.commentCountByBlock.value.get(blockId) ?? 0,
    openForBlock: openCommentsForBlock,
  },
  savedModules: {
    openSaveDialog: (blockId: string) =>
      savedModulesVisual.openSaveDialog(blockId),
    openBrowser: () => savedModulesVisual.openBrowserModal(),
    moduleCount: computed(() => savedModulesHeadless.modules.value.length),
  },
} satisfies EditorCapabilities);

// ---------------------------------------------------------------------------
// Theme overrides (plan-gated)
// ---------------------------------------------------------------------------

function setThemeOverrides(overrides: ThemeOverrides): void {
  if (!planConfigInstance.hasFeature("theme_customization")) {
    return;
  }
  core.themeOverrides.value = overrides;
}

function setUiTheme(theme: UiTheme): void {
  editor.setUiTheme(theme);
}

// ---------------------------------------------------------------------------
// Comments sidebar ref for block filtering
// ---------------------------------------------------------------------------

const commentsSidebarRef = ref<InstanceType<typeof CommentsSidebar> | null>(
  null,
);

function openCommentsForBlock(blockId: string): void {
  panelState.commentsOpen.value = true;
  nextTick(() => {
    commentsSidebarRef.value?.filterByBlock(blockId);
  });
}

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
  savedModulesVisual.closeBrowserModal();
}

// ---------------------------------------------------------------------------
// Custom blocks pre-render for save
// ---------------------------------------------------------------------------

async function preRenderCustomBlocks(content: TemplateContent): Promise<void> {
  const renderBlock = async (block: Block): Promise<void> => {
    if (isCustomBlock(block)) {
      const customBlock = block as CustomBlock;
      try {
        customBlock.renderedHtml =
          await core.registry.renderCustomBlock(customBlock);
      } catch {
        customBlock.renderedHtml = `<!-- Custom block render error: ${customBlock.customType} -->`;
      }
    }

    if (block.type === "section" && "children" in block) {
      const sectionBlock = block as { children: Block[][] };
      for (const column of sectionBlock.children) {
        for (const child of column) {
          await renderBlock(child);
        }
      }
    }
  };

  for (const block of content.blocks) {
    await renderBlock(block);
  }
}

// ---------------------------------------------------------------------------
// Cloud initialization
// ---------------------------------------------------------------------------

async function initialize(): Promise<void> {
  isInitializing.value = true;
  initError.value = null;

  try {
    // Auth
    await authManager.initialize();
    if (_destroyed) return;
    isAuthReady.value = true;

    // Health check
    const healthResult = await performHealthCheck({ authManager });
    if (_destroyed) return;

    if (!healthResult.api.ok) {
      throw new Error("Health check failed: API is not reachable");
    }

    if (!healthResult.auth.ok) {
      throw new Error(
        `Health check failed: authentication error${healthResult.auth.error ? ` - ${healthResult.auth.error}` : ""}`,
      );
    }

    if (!healthResult.websocket.ok) {
      console.warn(
        "[Templatical] WebSocket health check failed:",
        healthResult.websocket.error ?? "unknown error",
        "-- real-time features will be disabled.",
      );
    }

    // Plan config
    await planConfigInstance.fetchConfig();
    if (_destroyed) return;

    // Update fonts
    props.fontsManager.setCustomFontsEnabled(
      planConfigInstance.hasFeature("custom_fonts"),
    );

    // Register custom blocks if feature is enabled and definitions provided
    if (
      props.config.customBlocks?.length &&
      planConfigInstance.hasFeature("custom_blocks")
    ) {
      core.registerCustomBlocks(props.config.customBlocks);
    }

    // Apply theme
    if (
      props.config.theme &&
      planConfigInstance.hasFeature("theme_customization")
    ) {
      core.themeOverrides.value = props.config.theme;
    }

    // Load saved modules
    if (
      props.config.modules !== false &&
      planConfigInstance.hasFeature("saved_modules")
    ) {
      savedModulesHeadless.loadModules();
    }

    emit("ready");
  } catch (error) {
    if (_destroyed) return;
    const wrappedError =
      error instanceof Error
        ? error
        : new Error("Initialization failed", { cause: error });
    initError.value = wrappedError;
    props.config.onError?.(wrappedError);
  } finally {
    if (!_destroyed) {
      isInitializing.value = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Template lifecycle methods
// ---------------------------------------------------------------------------

function getWebSocketConfig() {
  return resolveWebSocketConfig(planConfigInstance.config.value!.websocket);
}

async function createTemplate(content?: TemplateContent): Promise<Template> {
  const template = await editor.create(content);
  if (_destroyed) return template;
  props.config.onCreate?.(template);
  snapshotPreview.initSnapshotHistory();
  websocket.connect(template.id, getWebSocketConfig());
  return template;
}

async function loadTemplate(templateId: string): Promise<Template> {
  const template = await editor.load(templateId);
  if (_destroyed) return template;
  props.config.onLoad?.(template);
  snapshotPreview.initSnapshotHistory();
  websocket.connect(template.id, getWebSocketConfig());
  return template;
}

async function saveTemplate(): Promise<SaveResult> {
  featureFlags.isSaveExporting.value = true;
  featureFlags.saveStatus.value = "idle";
  try {
    // Pre-render custom blocks so backend can include them in MJML export
    await preRenderCustomBlocks(editor.content.value);
    if (_destroyed) throw new Error("Component unmounted during save");

    const template = await editor.save();
    if (_destroyed) throw new Error("Component unmounted during save");

    snapshotPreview.initSnapshotHistory();

    if (snapshotPreview.snapshotHistoryInstance.value) {
      snapshotPreview.snapshotHistoryInstance.value.loadSnapshots();
    }

    const exportResult = await exporter.exportHtml(template.id);
    if (_destroyed) throw new Error("Component unmounted during save");

    const saveResult: SaveResult = {
      templateId: template.id,
      html: exportResult.html,
      mjml: exportResult.mjml,
      content: template.content,
    };

    props.config.onSave?.(saveResult);

    featureFlags.saveStatus.value = "saved";
    featureFlags.startSaveStatusClear();

    return saveResult;
  } catch (error) {
    if (!_destroyed) {
      featureFlags.saveStatus.value = "error";
      featureFlags.saveErrorMessage.value =
        error instanceof Error ? error.message : "Save failed";
    }
    throw error;
  } finally {
    if (!_destroyed) {
      featureFlags.isSaveExporting.value = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  core.installPlugins();
  initialize();
});

onUnmounted(() => {
  _destroyed = true;
  props.fontsManager.cleanupFontLinks();
  websocket.disconnect();
  core.destroy();
  props.config.onUnmount?.();
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

defineExpose({
  getContent: () => editor.content.value,
  setContent: (content: TemplateContent) => editor.setContent(content),
  setTheme: setUiTheme,
  setThemeOverrides: setThemeOverrides,
  create: createTemplate,
  load: loadTemplate,
  save: saveTemplate,
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
        @retry="initialize"
      />
    </Transition>

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
      <!-- Left: Logo + template count -->
      <div
        class="tpl-header-left tpl:flex tpl:min-w-[200px] tpl:items-center tpl:gap-3"
      >
        <div
          v-if="!featureFlags.isWhiteLabeled.value"
          class="tpl-logo tpl:flex tpl:items-center tpl:gap-2.5 tpl:text-sm tpl:font-semibold"
          style="color: var(--tpl-text)"
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
          class="tpl:text-xs tpl:opacity-60"
          style="color: var(--tpl-text-muted)"
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
          class="tpl-tooltip tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs"
          style="color: var(--tpl-danger)"
          :data-tooltip="featureFlags.saveErrorMessage.value"
        >
          <CircleAlert :size="12" :stroke-width="2.5" />
          {{ core.t.header.saveFailed }}
        </div>
        <div
          v-else-if="featureFlags.saveStatus.value === 'saved'"
          aria-live="polite"
          class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs"
          style="color: var(--tpl-success)"
        >
          <Check :size="12" :stroke-width="2.5" />
          {{ core.t.header.saved }}
        </div>
        <div
          v-else-if="editor.state.isDirty"
          aria-live="polite"
          class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs"
          style="color: var(--tpl-text-muted)"
        >
          <span
            class="tpl-pulse tpl:size-1.5 tpl:rounded-full"
            style="background-color: var(--tpl-primary)"
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
          @click="
            panelState.commentsOpen.value = !panelState.commentsOpen.value
          "
        >
          <MessageCircle :size="16" :stroke-width="2" />
          {{ core.t.comments.button }}
          <span
            v-if="
              commentsInstance.unresolvedCount.value > 0 &&
              !panelState.commentsOpen.value
            "
            class="tpl:inline-flex tpl:size-4.5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold"
            style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
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
          v-if="
            testEmail.isEnabled.value && featureFlags.canSendTestEmail.value
          "
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
          <Send
            v-if="!testEmail.isSending.value"
            :size="16"
            :stroke-width="2"
          />
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
          :disabled="
            editor.state.isSaving ||
            featureFlags.isSaveExporting.value ||
            !editor.state.isDirty
          "
          @click="
            saveTemplate().catch((err) => props.config.onError?.(err as Error))
          "
        >
          <Save
            v-if="!editor.state.isSaving && !featureFlags.isSaveExporting.value"
            :size="16"
            :stroke-width="2"
          />
          <LoaderCircle
            v-else
            class="tpl-spinner"
            :size="16"
            :stroke-width="2"
          />
          {{
            editor.state.isSaving || featureFlags.isSaveExporting.value
              ? core.t.header.saving
              : core.t.header.save
          }}
        </button>
      </div>
    </header>

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
      class="tpl-body tpl:absolute tpl:bottom-0 tpl:overflow-auto tpl:transition-all tpl:duration-300"
      style="
        transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
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

    <!-- Footer — powered-by branding (hidden when white-labeled) -->
    <footer
      v-if="!featureFlags.isWhiteLabeled.value"
      class="tpl:pointer-events-none tpl:absolute tpl:bottom-0 tpl:z-50 tpl:flex tpl:h-8 tpl:items-center tpl:justify-end tpl:pr-4 tpl:text-[9px] tpl:opacity-90 tpl:transition-all tpl:duration-300"
      :class="[
        editor.state.previewMode
          ? 'tpl:left-0 tpl:right-0'
          : panelState.rightPanelOpen.value
            ? 'tpl:left-12 tpl:right-[680px]'
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
        <span>{{ core.t.footer.poweredBy }}</span>
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
          {{ core.t.footer.openSource }}
        </a>
      </div>
    </footer>

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
    <template v-if="!isInitializing && isAuthReady">
      <AiChatSidebar
        :visible="panelState.aiChatOpen.value"
        :on-apply="
          (content: TemplateContent) => {
            core.history.record();
            editor.setContent(content);
            core.conditionPreview.reset();
          }
        "
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
        @apply="
          (content: TemplateContent) => {
            core.history.record();
            editor.setContent(content);
            core.conditionPreview.reset();
          }
        "
      />

      <CommentsSidebar
        ref="commentsSidebarRef"
        :visible="panelState.commentsOpen.value"
        @close="panelState.commentsOpen.value = false"
      />

      <TestEmailModal
        :visible="panelState.testEmailModalOpen.value"
        :allowed-emails="testEmail.allowedEmails.value"
        :is-sending="testEmail.isSending.value"
        :error="testEmail.error.value"
        @send="handleSendTestEmail"
        @close="panelState.testEmailModalOpen.value = false"
      />

      <SaveModuleDialog
        v-if="
          planConfigInstance.hasFeature('saved_modules') &&
          props.config.modules !== false
        "
        :visible="savedModulesVisual.showSaveDialog.value ?? false"
        :pre-selected-block-id="
          savedModulesVisual.preSelectedBlockId.value ?? null
        "
        @close="savedModulesVisual.closeSaveDialog()"
        @saved="savedModulesHeadless.loadModules()"
      />

      <ModuleBrowserModal
        v-if="
          planConfigInstance.hasFeature('saved_modules') &&
          props.config.modules !== false
        "
        :visible="savedModulesVisual.showBrowserModal.value ?? false"
        @close="savedModulesVisual.closeBrowserModal()"
        @insert="handleModuleInsert"
      />

      <MediaLibraryModal
        :visible="panelState.mediaLibraryOpen.value"
        :accept="panelState.mediaLibraryAccept.value"
        @select="mediaLib.handleMediaSelect"
        @close="mediaLib.handleMediaLibraryClose"
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
