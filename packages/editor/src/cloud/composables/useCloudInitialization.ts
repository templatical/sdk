import { computed, provide, ref, watch, type ComputedRef, type Ref } from "vue";
import {
  AuthManager,
  performHealthCheck,
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
  type UseAiConfigReturn,
  type UseCollaborationReturn,
  type UseCommentsReturn,
  type UseExportReturn,
  type UsePlanConfigReturn,
  type UseSavedModulesReturn,
  type UseTemplateScoringReturn,
  type UseTestEmailReturn,
  type UseWebSocketReturn,
  type UseEditorReturn as CloudUseEditorReturn,
} from "@templatical/core/cloud";
import type {
  McpOperationPayload,
  SaveResult,
  ThemeOverrides,
  UiTheme,
} from "@templatical/types";

import {
  useEditorCore,
  type UseEditorCoreReturn,
} from "../../composables/useEditorCore";
import { resolveAccessibilityOptions } from "../../utils/resolveAccessibilityOptions";
import { useDragDrop } from "../../composables/useDragDrop";
import type { UseFontsReturn } from "../../composables/useFonts";
import type { Translations } from "../../i18n";
import type { EditorCapabilities } from "../../types/editor-capabilities";
import {
  ON_REQUEST_MEDIA_KEY,
  AUTH_MANAGER_KEY,
  AI_CONFIG_KEY,
  COMMENTS_KEY,
  SAVED_MODULES_HEADLESS_KEY,
  SCORING_KEY,
  CAPABILITIES_KEY,
} from "../../keys";
import { DEFAULT_AUTO_SAVE_DEBOUNCE_MS } from "../../constants/timeouts";
import { logger } from "../../utils/logger";

import {
  useSnapshotPreview,
  type UseSnapshotPreviewReturn,
} from "./useSnapshotPreview";
import {
  useCloudPanelState,
  type UseCloudPanelStateReturn,
} from "./useCloudPanelState";
import { useCollabUndoWarning } from "./useCollabUndoWarning";
import {
  useCloudFeatureFlags,
  type UseCloudFeatureFlagsReturn,
} from "./useCloudFeatureFlags";
import {
  useCloudMediaLibrary,
  type UseCloudMediaLibraryReturn,
} from "./useCloudMediaLibrary";

import type { TemplaticalCloudEditorConfig } from "../cloudConfig";

/** Minimal interface of the CommentsSidebar-filter target. */
interface CommentsSidebarInstance {
  filterByBlock: (blockId: string) => void;
}

/** Getter for the target — evaluated lazily so the sidebar can mount later. */
type CommentsSidebarGetter = () => CommentsSidebarInstance | null;

type CollaborationInstance = UseCollaborationReturn & {
  _broadcastOperation: (payload: McpOperationPayload) => void;
  _isProcessingRemoteOperation: () => boolean;
};

export interface UseCloudInitializationOptions {
  config: TemplaticalCloudEditorConfig;
  translations: Translations;
  fontsManager: UseFontsReturn;
  emit: (event: "ready") => void;
  /** Lazy getter for the CommentsSidebar-filter target (for block-filter). */
  getCommentsSidebar: CommentsSidebarGetter;
}

export interface UseCloudInitializationReturn {
  // Init state
  isInitializing: Ref<boolean>;
  isAuthReady: Ref<boolean>;
  initError: Ref<Error | null>;
  isDestroyed: () => boolean;

  // Infrastructure
  authManager: AuthManager;
  planConfigInstance: UsePlanConfigReturn;
  websocket: UseWebSocketReturn;
  collaboration: CollaborationInstance | null;
  isCollaborationEnabled: ComputedRef<boolean>;

  // Editor + core
  editor: CloudUseEditorReturn;
  core: UseEditorCoreReturn;

  // Cloud composables
  aiConfig: UseAiConfigReturn;
  featureFlags: UseCloudFeatureFlagsReturn;
  mediaLib: UseCloudMediaLibraryReturn;
  exporter: UseExportReturn;
  testEmail: UseTestEmailReturn;
  commentsInstance: UseCommentsReturn;
  savedModulesHeadless: UseSavedModulesReturn;
  scoringInstance: UseTemplateScoringReturn;
  panelState: UseCloudPanelStateReturn;
  snapshotPreview: UseSnapshotPreviewReturn;
  collabWarning: ReturnType<typeof useCollabUndoWarning>;

  // Local UI state surfaced through capabilities
  showSaveModuleDialog: Ref<boolean>;
  showModuleBrowserModal: Ref<boolean>;
  saveModulePreSelectedBlockId: Ref<string | null>;

  // Late-bound save hook — set by `useCloudLifecycle` after it wires saveTemplate.
  // The `onSave` keyboard shortcut + `useEditorCore` autoSave both route here.
  onSaveHook: { value: (() => Promise<unknown>) | null };

  // Methods
  initialize: () => Promise<void>;
  destroy: () => void;
  setThemeOverrides: (overrides: ThemeOverrides) => void;
  setUiTheme: (theme: UiTheme) => void;
  openCommentsForBlock: (blockId: string) => void;
}

/**
 * Owns the entire CloudEditor.vue initialization dance:
 *   1. AuthManager + PlanConfig
 *   2. Collaboration locked-blocks forward-ref
 *   3. Cloud editor
 *   4. WebSocket + MCP listener
 *   5. Collaboration (wraps editor methods — MUST precede useEditorCore)
 *   6. useEditorCore (provides all shared keys)
 *   7. Collab undo warning (needs core.history.canUndo)
 *   8. Snapshot preview (needs core.autoSave)
 *   9. Remaining cloud composables (aiConfig, exporter, testEmail, etc.)
 *  10. Cloud-only provides (including CAPABILITIES_KEY override)
 *
 * Forward-ref pattern for `snapshotPreview` / `collabWarning` is contained
 * here instead of leaking to the parent.
 */
export function useCloudInitialization(
  options: UseCloudInitializationOptions,
): UseCloudInitializationReturn {
  const { config, translations, fontsManager, emit, getCommentsSidebar } =
    options;

  // --- Init state ---
  const isInitializing = ref(true);
  const isAuthReady = ref(false);
  const initError = ref<Error | null>(null);
  let _destroyed = false;

  // --- Late-bound save hook (filled in by useCloudLifecycle) ---
  const onSaveHook: { value: (() => Promise<unknown>) | null } = {
    value: null,
  };

  // --- Forward refs for circular composable dependencies ---
  let snapshotPreviewRef: UseSnapshotPreviewReturn | null = null;
  let collabWarningRef: ReturnType<typeof useCollabUndoWarning> | null = null;

  // --- 1. AuthManager + PlanConfig ---
  const authManager = new AuthManager({
    ...config.auth,
    onError: config.onError,
  });

  const planConfigInstance = usePlanConfig({
    authManager,
    onError: config.onError,
  });

  // --- 2. Collaboration locked blocks ref (forward-declared for step 3) ---
  const collaborationLockedBlocks = ref<Map<string, unknown>>(new Map());

  // --- 3. Cloud editor ---
  const editor = useEditor({
    authManager,
    defaultFontFamily: config.fonts?.defaultFont,
    templateDefaults: config.templateDefaults,
    onError: config.onError,
    lockedBlocks: collaborationLockedBlocks,
  });

  // --- 4. WebSocket + MCP listener ---
  const websocket = useWebSocket({
    authManager,
    onError: config.onError,
  });

  if (config.mcp?.enabled) {
    useMcpListener({
      editor,
      channel: websocket.channel,
      onOperation: config.mcp.onOperation,
    });
  }

  // --- 5. Collaboration (MUST precede useEditorCore) ---
  //
  // Order: `useCollaborationBroadcast` wraps editor mutation methods so they
  // broadcast to peers. Step 6's `useHistoryInterceptor` then wraps them
  // AGAIN to push history entries. Reversing would push history for remote
  // operations, causing local/remote state drift.
  let collaboration: CollaborationInstance | null = null;

  if (config.collaboration?.enabled) {
    collaboration = useCollaboration({
      authManager,
      editor,
      channel: websocket.channel,
      onError: config.onError,
      onCollaboratorJoined: config.collaboration.onCollaboratorJoined,
      onCollaboratorLeft: config.collaboration.onCollaboratorLeft,
      onBlockLocked: config.collaboration.onBlockLocked,
      onBlockUnlocked: config.collaboration.onBlockUnlocked,
    }) as CollaborationInstance;

    watch(
      () => collaboration!.lockedBlocks.value,
      (newLockedBlocks) => {
        collaborationLockedBlocks.value = newLockedBlocks;
      },
      { immediate: true },
    );

    useCollaborationBroadcast(editor, collaboration);
  }

  const isCollaborationEnabled = computed(
    () =>
      !!config.collaboration?.enabled &&
      planConfigInstance.hasFeature("collaboration"),
  );

  // --- 6. useEditorCore ---
  const core = useEditorCore({
    editor,
    config: {
      uiTheme: config.uiTheme,
      theme: undefined, // applied in initialize() after plan check
      blockDefaults: config.blockDefaults,
      customBlocks: [], // deferred to initialize()
      mergeTags: config.mergeTags,
      displayConditions: config.displayConditions,
      onRequestMedia: null, // cloud handles via mediaLib.handleRequestMedia
      accessibility: resolveAccessibilityOptions(config),
      onSave: () => {
        onSaveHook.value?.().catch((err) => {
          config.onError?.(err as Error);
        });
      },
    },
    translations,
    fontsManager,
    historyOptions: collaboration
      ? {
          isRemoteOperation: () =>
            collaboration!._isProcessingRemoteOperation(),
        }
      : undefined,
    autoSaveOptions: {
      onChange: async () => {
        if (editor.hasTemplate()) {
          await editor.createSnapshot();
          snapshotPreviewRef?.snapshotHistoryInstance.value?.loadSnapshots();
        }
      },
      debounce: config.autoSaveDebounce ?? DEFAULT_AUTO_SAVE_DEBOUNCE_MS,
      enabled: () =>
        config.autoSave !== false && planConfigInstance.hasFeature("auto_save"),
    },
    themeExtraStyles: () => ({
      "--tpl-drop-text": `"${translations.canvas.dropHere}"`,
    }),
    keyboardOptions: {
      onBeforeUndo: () => collabWarningRef?.showCollabUndoWarning(),
    },
  });

  // --- 7. Collab undo warning ---
  const collabWarning = useCollabUndoWarning({
    isCollaborationEnabled,
    getCollaboratorCount: () => collaboration?.collaborators.value.length ?? 0,
    canUndo: core.history.canUndo,
  });
  collabWarningRef = collabWarning;

  // --- 8. Snapshot preview ---
  const snapshotPreview = useSnapshotPreview({
    authManager,
    editor,
    history: core.history,
    conditionPreview: core.conditionPreview,
    autoSave: core.autoSave,
    onError: config.onError,
  });
  snapshotPreviewRef = snapshotPreview;

  // --- 9. Remaining cloud composables ---
  const panelState = useCloudPanelState();
  const aiConfig = useAiConfig(config.ai);

  const featureFlags = useCloudFeatureFlags({
    planConfigInstance,
    aiConfig,
    editor,
  });

  const mediaLib = useCloudMediaLibrary({
    onRequestMedia: config.onRequestMedia,
    mediaLibraryOpen: panelState.mediaLibraryOpen,
    mediaLibraryAccept: panelState.mediaLibraryAccept,
  });

  // Install drag-drop listeners (no return value needed).
  useDragDrop({
    onBlockMove: editor.moveBlock,
    onBlockAdd: editor.addBlock,
  });

  const exporter = useExport({
    authManager,
    getFontsConfig: () => config.fonts,
    canUseCustomFonts: () => planConfigInstance.hasFeature("custom_fonts"),
  });

  const testEmail = useTestEmail({
    authManager,
    getTemplateId: () => editor.state.template?.id ?? null,
    save: () => editor.save(),
    exportHtml: (templateId: string) => exporter.exportHtml(templateId),
    onError: config.onError,
    isAuthReady,
    onBeforeTestEmail: config.onBeforeTestEmail,
  });

  const commentsInstance = useComments({
    authManager,
    getTemplateId: () => editor.state.template?.id ?? null,
    getSocketId: () => websocket.getSocketId(),
    onComment: config.onComment,
    onError: config.onError,
    isAuthReady,
    hasCommentingFeature: () =>
      config.commenting !== false &&
      planConfigInstance.hasFeature("commenting"),
  });

  useCommentListener({
    comments: commentsInstance,
    channel: websocket.channel,
  });

  const savedModulesHeadless = useSavedModules({
    authManager,
    onError: config.onError,
  });
  const showSaveModuleDialog = ref(false);
  const saveModulePreSelectedBlockId = ref<string | null>(null);
  const showModuleBrowserModal = ref(false);

  const scoringInstance = useTemplateScoring({
    authManager,
    getTemplateId: () => editor.state.template?.id ?? null,
  });

  // --- Comments block-filter bridge ---
  function openCommentsForBlock(blockId: string): void {
    panelState.commentsOpen.value = true;
    // Sidebar may not be mounted yet (async component); defer look-up.
    queueMicrotask(() => {
      getCommentsSidebar()?.filterByBlock(blockId);
    });
  }

  // --- 10. Cloud-only provides ---
  provide(ON_REQUEST_MEDIA_KEY, mediaLib.handleRequestMedia);
  provide(AUTH_MANAGER_KEY, authManager);
  provide(AI_CONFIG_KEY, aiConfig);
  provide(COMMENTS_KEY, commentsInstance);
  provide(SAVED_MODULES_HEADLESS_KEY, savedModulesHeadless);
  provide(SCORING_KEY, scoringInstance);

  // Override default capabilities from useEditorCore with cloud capabilities.
  provide(CAPABILITIES_KEY, {
    plan: planConfigInstance,
    ai: aiConfig,
    comments: {
      getBlockCount: (blockId: string) =>
        commentsInstance.commentCountByBlock.value.get(blockId) ?? 0,
      openForBlock: openCommentsForBlock,
    },
    savedModules: {
      openSaveDialog: (blockId: string) => {
        saveModulePreSelectedBlockId.value = blockId ?? null;
        showSaveModuleDialog.value = true;
      },
      openBrowser: () => {
        showModuleBrowserModal.value = true;
      },
      moduleCount: computed(() => savedModulesHeadless.modules.value.length),
    },
  } satisfies EditorCapabilities);

  // --- Theme setters (plan-gated) ---
  function setThemeOverrides(overrides: ThemeOverrides): void {
    if (!planConfigInstance.hasFeature("theme_customization")) return;
    core.themeOverrides.value = overrides;
  }

  function setUiTheme(theme: UiTheme): void {
    editor.setUiTheme(theme);
  }

  // --- Initialize (async bootstrap) ---
  async function initialize(): Promise<void> {
    isInitializing.value = true;
    initError.value = null;

    try {
      await authManager.initialize();
      if (_destroyed) return;
      isAuthReady.value = true;

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
        logger.warn(
          "WebSocket health check failed:",
          healthResult.websocket.error ?? "unknown error",
          "-- real-time features will be disabled.",
        );
      }

      await planConfigInstance.fetchConfig();
      if (_destroyed) return;

      fontsManager.setCustomFontsEnabled(
        planConfigInstance.hasFeature("custom_fonts"),
      );

      if (
        config.customBlocks?.length &&
        planConfigInstance.hasFeature("custom_blocks")
      ) {
        core.registerCustomBlocks(config.customBlocks);
      }

      if (
        config.theme &&
        planConfigInstance.hasFeature("theme_customization")
      ) {
        core.themeOverrides.value = config.theme;
      }

      if (
        config.modules !== false &&
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
      config.onError?.(wrappedError);
    } finally {
      if (!_destroyed) {
        isInitializing.value = false;
      }
    }
  }

  function destroy(): void {
    _destroyed = true;
    fontsManager.cleanupFontLinks();
    websocket.disconnect();
    core.destroy();
    config.onUnmount?.();
  }

  return {
    isInitializing,
    isAuthReady,
    initError,
    isDestroyed: () => _destroyed,

    authManager,
    planConfigInstance,
    websocket,
    collaboration,
    isCollaborationEnabled,

    editor,
    core,

    aiConfig,
    featureFlags,
    mediaLib,
    exporter,
    testEmail,
    commentsInstance,
    savedModulesHeadless,
    scoringInstance,
    panelState,
    snapshotPreview,
    collabWarning,

    showSaveModuleDialog,
    showModuleBrowserModal,
    saveModulePreSelectedBlockId,

    onSaveHook,

    initialize,
    destroy,
    setThemeOverrides,
    setUiTheme,
    openCommentsForBlock,
  };
}
