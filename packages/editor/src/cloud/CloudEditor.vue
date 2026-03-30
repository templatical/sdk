<script setup lang="ts">
import type { AiFeature } from "./components/AiFeatureMenu.vue";
import type {
  Block,
  CollaborationConfig,
  CommentEvent,
  CustomBlock,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  FontsConfig,
  McpConfig,
  MergeTagsConfig,
  SaveResult,
  Template,
  TemplateContent,
  TemplateSnapshot,
  ThemeOverrides,
} from "@templatical/types";
import type {
  MediaCategory,
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";
import {
  cloneBlock,
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTextBlock,
  createCountdownBlock,
  createVideoBlock,
  isCustomBlock,
  resolveSyntax,
} from "@templatical/types";
import type { EditorPlugin } from "@templatical/core";
import {
  useAutoSave,
  useBlockActions,
  useConditionPreview,
  useHistory,
} from "@templatical/core";
import {
  AuthManager,
  performHealthCheck,
  resolveWebSocketConfig,
  useAiConfig,
  useCollaboration,
  useCommentListener,
  useComments,
  useEditor,
  useExport,
  useMcpListener,
  usePlanConfig,
  useSavedModules,
  useSnapshotHistory,
  useTestEmail,
  useWebSocket,
  type UseCollaborationReturn,
  type UseSnapshotHistoryReturn,
} from "@templatical/core/cloud";
import type { UseFontsReturn } from "../composables/useFonts";
import type { McpOperationPayload, MediaResult } from "@templatical/types";
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
} from "vue";
import { onClickOutside, useEventListener, useTimeoutFn } from "@vueuse/core";
import {
  AlertCircle,
  Clock,
  Loader2,
  MessageCircle,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from "lucide-vue-next";

import Canvas from "../components/Canvas.vue";
import Sidebar from "../components/Sidebar.vue";
import RightSidebar from "../components/RightSidebar.vue";
import ViewportToggle from "../components/ViewportToggle.vue";
import PreviewToggle from "../components/PreviewToggle.vue";
import DarkModeToggle from "../components/DarkModeToggle.vue";
import CustomBlockComponent from "../components/blocks/CustomBlock.vue";
import ButtonBlock from "../components/blocks/ButtonBlock.vue";
import DividerBlock from "../components/blocks/DividerBlock.vue";
import HtmlBlock from "../components/blocks/HtmlBlock.vue";
import ImageBlock from "../components/blocks/ImageBlock.vue";
import MenuBlock from "../components/blocks/MenuBlock.vue";
import SectionBlock from "../components/blocks/SectionBlock.vue";
import SocialIconsBlock from "../components/blocks/SocialIconsBlock.vue";
import SpacerBlock from "../components/blocks/SpacerBlock.vue";
import TableBlock from "../components/blocks/TableBlock.vue";
import TextBlock from "../components/blocks/TextBlock.vue";
import VideoBlock from "../components/blocks/VideoBlock.vue";
import CountdownBlockComponent from "../components/blocks/CountdownBlock.vue";
import type { Translations } from "../i18n";
import { useBlockRegistry } from "../composables/useBlockRegistry";
import { useI18n } from "../composables/useI18n";
import { useDragDrop } from "../composables/useDragDrop";
import { useVisualSavedModules } from "./composables/useSavedModules";
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
// i18n — translations are pre-loaded and passed as prop (same as old editor)
// ---------------------------------------------------------------------------

provide("translations", props.translations);

const { t, format } = useI18n(props.translations);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const themeOverrides = ref<ThemeOverrides>({});

const themeVarMapping: Record<keyof ThemeOverrides, string> = {
  bg: "--tpl-bg",
  bgElevated: "--tpl-bg-elevated",
  bgHover: "--tpl-bg-hover",
  bgActive: "--tpl-bg-active",
  border: "--tpl-border",
  borderLight: "--tpl-border-light",
  text: "--tpl-text",
  textMuted: "--tpl-text-muted",
  textDim: "--tpl-text-dim",
  primary: "--tpl-primary",
  primaryHover: "--tpl-primary-hover",
  primaryLight: "--tpl-primary-light",
  secondary: "--tpl-secondary",
  secondaryHover: "--tpl-secondary-hover",
  secondaryLight: "--tpl-secondary-light",
  success: "--tpl-success",
  successLight: "--tpl-success-light",
  warning: "--tpl-warning",
  warningLight: "--tpl-warning-light",
  danger: "--tpl-danger",
  dangerLight: "--tpl-danger-light",
  canvasBg: "--tpl-canvas-bg",
};

const themeStyles = computed(() => {
  const styles: Record<string, string> = {};

  for (const [key, cssVar] of Object.entries(themeVarMapping)) {
    const value = themeOverrides.value[key as keyof ThemeOverrides];
    if (value) {
      styles[cssVar] = value;
    }
  }

  // Add drop text for drag-and-drop ghost element
  styles["--tpl-drop-text"] = `"${props.translations.canvas.dropHere}"`;

  return styles;
});

function setTheme(overrides: ThemeOverrides): void {
  if (!planConfigInstance.hasFeature("theme_customization")) {
    return;
  }
  themeOverrides.value = overrides;
}

// ---------------------------------------------------------------------------
// Cloud initialization state
// ---------------------------------------------------------------------------

const isInitializing = ref(true);
const isAuthReady = ref(false);
const initError = ref<Error | null>(null);

// ---------------------------------------------------------------------------
// 1. AuthManager
// ---------------------------------------------------------------------------

const authManager = new AuthManager({
  ...props.config.auth,
  onError: props.config.onError,
});

// ---------------------------------------------------------------------------
// 2. Plan config
// ---------------------------------------------------------------------------

const planConfigInstance = usePlanConfig({
  authManager,
  onError: props.config.onError,
});

// ---------------------------------------------------------------------------
// 3. Collaboration locked blocks ref
// ---------------------------------------------------------------------------

const collaborationLockedBlocks = ref<Map<string, unknown>>(new Map());

// ---------------------------------------------------------------------------
// 4. Cloud editor (API-backed)
// ---------------------------------------------------------------------------

const editor = useEditor({
  authManager,
  defaultFontFamily: props.config.fonts?.defaultFont,
  templateDefaults: props.config.templateDefaults,
  onError: props.config.onError,
  lockedBlocks: collaborationLockedBlocks,
});

// ---------------------------------------------------------------------------
// 5. Collaboration composable
// ---------------------------------------------------------------------------

let collaboration:
  | (UseCollaborationReturn & {
      _broadcastOperation: (payload: McpOperationPayload) => void;
      _isProcessingRemoteOperation: () => boolean;
    })
  | null = null;

// ---------------------------------------------------------------------------
// 6. WebSocket
// ---------------------------------------------------------------------------

const websocket = useWebSocket({
  authManager,
  onError: props.config.onError,
});

// ---------------------------------------------------------------------------
// 7. MCP listener
// ---------------------------------------------------------------------------

if (props.config.mcp?.enabled) {
  useMcpListener({
    editor,
    channel: websocket.channel,
    onOperation: props.config.mcp.onOperation,
  });
}

// ---------------------------------------------------------------------------
// 8. Collaboration mode — wrap editor methods for broadcasting
// ---------------------------------------------------------------------------

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
  const originalAddBlock = editor.addBlock;
  const originalUpdateBlock = editor.updateBlock;
  const originalRemoveBlock = editor.removeBlock;
  const originalMoveBlock = editor.moveBlock;
  const originalUpdateSettings = editor.updateSettings;
  const originalSetContent = editor.setContent;

  editor.addBlock = (block, targetSectionId?, columnIndex?) => {
    originalAddBlock(block, targetSectionId, columnIndex);
    collaboration!._broadcastOperation({
      operation: "add_block",
      data: {
        block,
        section_id: targetSectionId,
        column_index: columnIndex,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateBlock = (blockId, updates) => {
    originalUpdateBlock(blockId, updates);
    collaboration!._broadcastOperation({
      operation: "update_block",
      data: { block_id: blockId, updates },
      timestamp: Date.now(),
    });
  };

  editor.removeBlock = (blockId) => {
    originalRemoveBlock(blockId);
    collaboration!._broadcastOperation({
      operation: "delete_block",
      data: { block_id: blockId },
      timestamp: Date.now(),
    });
  };

  editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
    originalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
    collaboration!._broadcastOperation({
      operation: "move_block",
      data: {
        block_id: blockId,
        index: newIndex,
        section_id: targetSectionId,
        column_index: columnIndex,
      },
      timestamp: Date.now(),
    });
  };

  editor.updateSettings = (updates) => {
    originalUpdateSettings(updates);
    collaboration!._broadcastOperation({
      operation: "update_settings",
      data: { updates },
      timestamp: Date.now(),
    });
  };

  editor.setContent = (content, markDirty?) => {
    originalSetContent(content, markDirty);
    collaboration!._broadcastOperation({
      operation: "set_content",
      data: { content },
      timestamp: Date.now(),
    });
  };
}

const isCollaborationEnabled = computed(
  () =>
    !!props.config.collaboration?.enabled &&
    planConfigInstance.hasFeature("collaboration"),
);

// ---------------------------------------------------------------------------
// 9. Condition preview
// ---------------------------------------------------------------------------

const conditionPreview = useConditionPreview(editor);

// ---------------------------------------------------------------------------
// 10. Block actions
// ---------------------------------------------------------------------------

const blockActions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
  blockDefaults: props.config.blockDefaults,
});

// ---------------------------------------------------------------------------
// 11. Drag-drop
// ---------------------------------------------------------------------------

const dragDrop = useDragDrop({
  onBlockMove: editor.moveBlock,
  onBlockAdd: editor.addBlock,
});

// ---------------------------------------------------------------------------
// 12. Exporter
// ---------------------------------------------------------------------------

const exporter = useExport({
  authManager,
  getFontsConfig: () => props.config.fonts,
  canUseCustomFonts: () => planConfigInstance.hasFeature("custom_fonts"),
});

// ---------------------------------------------------------------------------
// 13. Test email
// ---------------------------------------------------------------------------

const testEmail = useTestEmail({
  authManager,
  getTemplateId: () => editor.state.template?.id ?? null,
  save: () => editor.save(),
  exportHtml: (templateId: string) => exporter.exportHtml(templateId),
  onError: props.config.onError,
  isAuthReady,
  onBeforeTestEmail: props.config.onBeforeTestEmail,
});

// ---------------------------------------------------------------------------
// 14. History (undo/redo)
// ---------------------------------------------------------------------------

const history = useHistory({
  content: editor.content,
  setContent: (content, markDirty?) => editor.setContent(content, markDirty),
  isRemoteOperation: collaboration
    ? () => collaboration!._isProcessingRemoteOperation()
    : undefined,
});

// Wrap editor mutation methods to record history snapshots
const historyOriginalAddBlock = editor.addBlock;
const historyOriginalRemoveBlock = editor.removeBlock;
const historyOriginalMoveBlock = editor.moveBlock;
const historyOriginalUpdateBlock = editor.updateBlock;
const historyOriginalUpdateSettings = editor.updateSettings;

editor.addBlock = (block, targetSectionId?, columnIndex?, index?) => {
  history.record();
  historyOriginalAddBlock(block, targetSectionId, columnIndex, index);
};

editor.removeBlock = (blockId) => {
  history.record();
  historyOriginalRemoveBlock(blockId);
};

editor.moveBlock = (blockId, newIndex, targetSectionId?, columnIndex?) => {
  history.record();
  historyOriginalMoveBlock(blockId, newIndex, targetSectionId, columnIndex);
};

editor.updateBlock = (blockId, updates) => {
  history.recordDebounced(blockId);
  historyOriginalUpdateBlock(blockId, updates);
};

editor.updateSettings = (updates) => {
  history.record();
  historyOriginalUpdateSettings(updates);
};

// ---------------------------------------------------------------------------
// 15. Collab undo warning
// ---------------------------------------------------------------------------

let collabUndoWarningFired = false;
const collabUndoWarningVisible = ref(false);

function showCollabUndoWarning(): void {
  if (
    collabUndoWarningFired ||
    !collaboration ||
    !isCollaborationEnabled.value ||
    collaboration.collaborators.value.length === 0 ||
    !history.canUndo.value
  ) {
    return;
  }

  collabUndoWarningFired = true;
  collabUndoWarningVisible.value = true;
  useTimeoutFn(() => {
    collabUndoWarningVisible.value = false;
  }, 4000);
}

// ---------------------------------------------------------------------------
// 16. Auto-save
// ---------------------------------------------------------------------------

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: async () => {
    if (editor.hasTemplate()) {
      await editor.createSnapshot();
      if (snapshotHistoryInstance.value) {
        snapshotHistoryInstance.value.loadSnapshots();
      }
    }
  },
  debounce: props.config.autoSaveDebounce ?? 5000,
  enabled: () =>
    props.config.autoSave !== false &&
    planConfigInstance.hasFeature("auto_save"),
});

// Pause/resume auto-save during history navigation
watch(history.isNavigating, (navigating) => {
  if (navigating) {
    autoSave.pause();
  } else {
    autoSave.resume();
  }
});

// ---------------------------------------------------------------------------
// 17. AI config
// ---------------------------------------------------------------------------

const aiConfig = useAiConfig(props.config.ai);

// ---------------------------------------------------------------------------
// 18. Comments
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 19. Saved modules
// ---------------------------------------------------------------------------

const savedModulesHeadless = useSavedModules({
  authManager,
  onError: props.config.onError,
});
const savedModulesVisual = useVisualSavedModules(savedModulesHeadless);

// ---------------------------------------------------------------------------
// 20. Block registry
// ---------------------------------------------------------------------------

const registry = useBlockRegistry();

// Register all built-in block types
registry.registerBuiltIn("section", {
  component: SectionBlock,
  createBlock: () => createSectionBlock(),
  sidebarItem: { type: "section", label: "Section", isCustom: false },
});
registry.registerBuiltIn("text", {
  component: TextBlock,
  createBlock: () => createTextBlock(),
  sidebarItem: { type: "text", label: "Text", isCustom: false },
});
registry.registerBuiltIn("image", {
  component: ImageBlock,
  createBlock: () => createImageBlock(),
  sidebarItem: { type: "image", label: "Image", isCustom: false },
});
registry.registerBuiltIn("button", {
  component: ButtonBlock,
  createBlock: () => createButtonBlock(),
  sidebarItem: { type: "button", label: "Button", isCustom: false },
});
registry.registerBuiltIn("divider", {
  component: DividerBlock,
  createBlock: () => createDividerBlock(),
  sidebarItem: { type: "divider", label: "Divider", isCustom: false },
});
registry.registerBuiltIn("video", {
  component: VideoBlock,
  createBlock: () => createVideoBlock(),
  sidebarItem: { type: "video", label: "Video", isCustom: false },
});
registry.registerBuiltIn("social", {
  component: SocialIconsBlock,
  createBlock: () => createSocialIconsBlock(),
  sidebarItem: { type: "social", label: "Social", isCustom: false },
});
registry.registerBuiltIn("menu", {
  component: MenuBlock,
  createBlock: () => createMenuBlock(),
  sidebarItem: { type: "menu", label: "Menu", isCustom: false },
});
registry.registerBuiltIn("table", {
  component: TableBlock,
  createBlock: () => createTableBlock(),
  sidebarItem: { type: "table", label: "Table", isCustom: false },
});
registry.registerBuiltIn("spacer", {
  component: SpacerBlock,
  createBlock: () => createSpacerBlock(),
  sidebarItem: { type: "spacer", label: "Spacer", isCustom: false },
});
registry.registerBuiltIn("html", {
  component: HtmlBlock,
  createBlock: () => createHtmlBlock(),
  sidebarItem: { type: "html", label: "HTML", isCustom: false },
});
registry.registerBuiltIn("countdown", {
  component: CountdownBlockComponent,
  createBlock: () => createCountdownBlock(),
  sidebarItem: { type: "countdown", label: "Countdown", isCustom: false },
});

// ---------------------------------------------------------------------------
// 21. Provides — all synchronous, matching what child components inject
// ---------------------------------------------------------------------------

provide("editor", editor);
provide("history", history);
provide("blockActions", blockActions);
provide("dragDrop", dragDrop);
provide("conditionPreview", conditionPreview);
provide("fontsManager", props.fontsManager);
provide("themeStyles", themeStyles);
provide("blockDefaults", props.config.blockDefaults);
provide("blockRegistry", registry);
provide("customBlockDefinitions", props.config.customBlocks ?? []);

// Merge tags
const mergeTagSyntax = resolveSyntax(props.config.mergeTags?.syntax);
provide("mergeTags", props.config.mergeTags?.tags ?? []);
provide("mergeTagSyntax", mergeTagSyntax);
provide("onRequestMergeTag", props.config.mergeTags?.onRequest ?? null);

// Display conditions
provide("displayConditions", props.config.displayConditions?.conditions ?? []);
provide(
  "allowCustomConditions",
  props.config.displayConditions?.allowCustom ?? false,
);

// Media — provide config-like object for ImageField + separate provide
provide("onRequestMedia", handleRequestMedia);
provide("config", { onRequestMedia: handleRequestMedia });

// Cloud-specific provides
provide("authManager", authManager);
provide(
  "projectId",
  computed(() => authManager.projectId),
);
provide("planConfig", planConfigInstance);
provide("aiConfig", aiConfig);
provide("comments", commentsInstance);
provide("openCommentsForBlock", openCommentsForBlock);
provide("savedModules", savedModulesVisual);
provide("savedModulesHeadless", savedModulesHeadless);

// ---------------------------------------------------------------------------
// Snapshot history
// ---------------------------------------------------------------------------

const snapshotHistoryInstance = shallowRef<UseSnapshotHistoryReturn | null>(
  null,
);
const previewingSnapshot = ref<TemplateSnapshot | null>(null);
const contentBeforePreview = ref<TemplateContent | null>(null);

const isPreviewingSnapshot = computed(() => previewingSnapshot.value !== null);
const snapshotHistorySnapshots = computed(
  () => snapshotHistoryInstance.value?.snapshots.value ?? [],
);
const snapshotHistoryIsLoading = computed(
  () => snapshotHistoryInstance.value?.isLoading.value ?? false,
);
const snapshotHistoryIsRestoring = computed(
  () => snapshotHistoryInstance.value?.isRestoring.value ?? false,
);

function initSnapshotHistory(): void {
  if (editor.state.template?.id && !snapshotHistoryInstance.value) {
    snapshotHistoryInstance.value = useSnapshotHistory({
      authManager,
      templateId: editor.state.template.id,
      onRestore: handleRestore,
      onError: props.config.onError,
    });
    snapshotHistoryInstance.value.loadSnapshots();
  }
}

function handleRestore(template: { content: TemplateContent }): void {
  editor.setContent(template.content, false);
  history.clear();
  conditionPreview.reset();
}

async function handleSnapshotNavigate(
  snapshot: TemplateSnapshot,
): Promise<void> {
  if (previewingSnapshot.value) {
    previewingSnapshot.value = snapshot;
    editor.setContent(snapshot.content, false);
    return;
  }

  if (editor.state.isDirty && editor.hasTemplate()) {
    await editor.createSnapshot();
  }

  contentBeforePreview.value = JSON.parse(JSON.stringify(editor.content.value));

  autoSave.pause();
  previewingSnapshot.value = snapshot;
  editor.setContent(snapshot.content, false);
}

async function confirmRestoreSnapshot(): Promise<void> {
  if (!previewingSnapshot.value || !snapshotHistoryInstance.value) return;

  await snapshotHistoryInstance.value.restoreSnapshot(
    previewingSnapshot.value.id,
  );
  await snapshotHistoryInstance.value.loadSnapshots();

  previewingSnapshot.value = null;
  contentBeforePreview.value = null;

  autoSave.resume();
}

function cancelPreview(): void {
  if (!previewingSnapshot.value || !contentBeforePreview.value) return;

  editor.setContent(contentBeforePreview.value, false);

  previewingSnapshot.value = null;
  contentBeforePreview.value = null;

  autoSave.resume();
}

async function loadSnapshotHistory(): Promise<void> {
  if (snapshotHistoryInstance.value) {
    await snapshotHistoryInstance.value.loadSnapshots();
  }
}

// ---------------------------------------------------------------------------
// Feature flags and computed state
// ---------------------------------------------------------------------------

const canUseAiGeneration = computed(
  () =>
    planConfigInstance.hasFeature("ai_generation") &&
    aiConfig.hasAnyMenuFeature.value,
);
const canSendTestEmail = computed(() =>
  planConfigInstance.hasFeature("test_email"),
);
const hasTemplateSaved = computed(() => !!editor.state.template?.id);
const isWhiteLabeled = computed(() =>
  planConfigInstance.hasFeature("white_label"),
);
const templateLimit = computed(
  () => planConfigInstance.config.value?.limits.max_templates ?? null,
);
const templateCount = computed(
  () => planConfigInstance.config.value?.template_count ?? 0,
);
const isSaveExporting = ref(false);

// ---------------------------------------------------------------------------
// Cloud UI state
// ---------------------------------------------------------------------------

const aiChatOpen = ref(false);
const scoringPanelOpen = ref(false);
const designReferenceOpen = ref(false);
const commentsOpen = ref(false);
const testEmailModalOpen = ref(false);
const mediaLibraryOpen = ref(false);
const mediaLibraryAccept = ref<MediaCategory[] | undefined>(undefined);
const aiMenuOpen = ref(false);
const aiMenuRef = ref<HTMLElement | null>(null);

const rightPanelOpen = computed(
  () =>
    aiChatOpen.value ||
    scoringPanelOpen.value ||
    designReferenceOpen.value ||
    commentsOpen.value,
);

// Mutual exclusion: only one right panel at a time
watch(scoringPanelOpen, (isOpen) => {
  if (isOpen) {
    aiChatOpen.value = false;
    designReferenceOpen.value = false;
    commentsOpen.value = false;
  }
});
watch(aiChatOpen, (isOpen) => {
  if (isOpen) {
    scoringPanelOpen.value = false;
    designReferenceOpen.value = false;
    commentsOpen.value = false;
  }
});
watch(designReferenceOpen, (isOpen) => {
  if (isOpen) {
    aiChatOpen.value = false;
    scoringPanelOpen.value = false;
    commentsOpen.value = false;
  }
});
watch(commentsOpen, (isOpen) => {
  if (isOpen) {
    aiChatOpen.value = false;
    scoringPanelOpen.value = false;
    designReferenceOpen.value = false;
  }
});

const activeAiFeature = computed<AiFeature | null>(() => {
  if (aiChatOpen.value) return "ai-chat";
  if (designReferenceOpen.value) return "design-reference";
  if (scoringPanelOpen.value) return "scoring";
  return null;
});

const aiButtonActive = computed(
  () =>
    aiMenuOpen.value ||
    aiChatOpen.value ||
    designReferenceOpen.value ||
    scoringPanelOpen.value,
);

function toggleAiMenu(): void {
  aiMenuOpen.value = !aiMenuOpen.value;
}

function handleAiFeatureSelect(feature: AiFeature): void {
  aiMenuOpen.value = false;

  if (feature === "ai-chat") {
    aiChatOpen.value = !aiChatOpen.value;
  } else if (feature === "design-reference") {
    designReferenceOpen.value = !designReferenceOpen.value;
  } else if (feature === "scoring") {
    scoringPanelOpen.value = !scoringPanelOpen.value;
  }
}

onClickOutside(aiMenuRef, () => {
  aiMenuOpen.value = false;
});

// ---------------------------------------------------------------------------
// Test email handler
// ---------------------------------------------------------------------------

async function handleSendTestEmail(recipient: string): Promise<void> {
  try {
    await testEmail.sendTestEmail(recipient);
    testEmailModalOpen.value = false;
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
// Comments sidebar ref for block filtering
// ---------------------------------------------------------------------------

const commentsSidebarRef = ref<InstanceType<typeof CommentsSidebar> | null>(
  null,
);

function openCommentsForBlock(blockId: string): void {
  commentsOpen.value = true;
  nextTick(() => {
    commentsSidebarRef.value?.filterByBlock(blockId);
  });
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

const isMac = ref(false);

function handleKeydown(event: KeyboardEvent): void {
  const modifier = isMac.value ? event.metaKey : event.ctrlKey;

  if (!modifier) return;

  // Cmd+S / Ctrl+S: save
  if (event.key === "s") {
    event.preventDefault();
    saveTemplate().catch((err) => props.config.onError?.(err as Error));
    return;
  }

  // Cmd+Z / Ctrl+Z: undo/redo
  if (event.key.toLowerCase() === "z") {
    // Let TipTap handle its own undo/redo when text is focused
    const target = event.target as HTMLElement;
    if (target.closest(".tpl-text-editable")) {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      history.redo();
    } else {
      showCollabUndoWarning();
      history.undo();
    }
  }
}

// ---------------------------------------------------------------------------
// Media library handler
// ---------------------------------------------------------------------------

let mediaResolve: ((result: MediaResult | null) => void) | null = null;

async function handleRequestMedia(): Promise<MediaResult | null> {
  // If consumer provides a custom media handler, use it
  if (props.config.onRequestMedia) {
    const item = await props.config.onRequestMedia({ accept: ["images"] });
    if (!item) return null;
    return { url: item.url, alt: item.alt_text || undefined };
  }

  // Otherwise open the built-in media library
  mediaLibraryAccept.value = ["images"];
  mediaLibraryOpen.value = true;
  return new Promise<MediaResult | null>((resolve) => {
    mediaResolve = (result) => {
      resolve(result);
    };
  });
}

function handleMediaSelect(item: MediaItem): void {
  mediaLibraryOpen.value = false;
  mediaResolve?.({ url: item.url, alt: item.alt_text || undefined });
  mediaResolve = null;
}

function handleMediaLibraryClose(): void {
  mediaLibraryOpen.value = false;
  mediaResolve?.(null);
  mediaResolve = null;
}

// ---------------------------------------------------------------------------
// Cloud initialization (async — auth, health check, plan config, features)
// ---------------------------------------------------------------------------

async function initialize(): Promise<void> {
  isInitializing.value = true;
  initError.value = null;

  try {
    // Auth
    await authManager.initialize();
    isAuthReady.value = true;

    // Health check
    const healthResult = await performHealthCheck({ authManager });

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
        "— real-time features will be disabled.",
      );
    }

    // Plan config
    await planConfigInstance.fetchConfig();

    // Update fonts
    props.fontsManager.setCustomFontsEnabled(
      planConfigInstance.hasFeature("custom_fonts"),
    );

    // Register custom blocks if feature is enabled and definitions provided
    if (
      props.config.customBlocks?.length &&
      planConfigInstance.hasFeature("custom_blocks")
    ) {
      for (const definition of props.config.customBlocks) {
        registry.registerCustom(definition, CustomBlockComponent);
      }
    }

    // Apply theme
    if (
      props.config.theme &&
      planConfigInstance.hasFeature("theme_customization")
    ) {
      themeOverrides.value = props.config.theme;
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
    const wrappedError =
      error instanceof Error ? error : new Error("Initialization failed");
    initError.value = wrappedError;
    props.config.onError?.(wrappedError);
  } finally {
    isInitializing.value = false;
  }
}

// ---------------------------------------------------------------------------
// Error display helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: Error): string {
  if (
    "isUnauthorized" in error &&
    (error as { isUnauthorized: boolean }).isUnauthorized
  ) {
    return t.error.authFailed;
  }
  if ("isNotFound" in error && (error as { isNotFound: boolean }).isNotFound) {
    return t.error.templateNotFound;
  }
  return t.error.defaultMessage;
}

function isNotFoundError(error: Error): boolean {
  return (
    "isNotFound" in error && !!(error as { isNotFound: boolean }).isNotFound
  );
}

// ---------------------------------------------------------------------------
// Template lifecycle methods
// ---------------------------------------------------------------------------

function getWebSocketConfig() {
  return resolveWebSocketConfig(planConfigInstance.config.value!.websocket);
}

async function createTemplate(content?: TemplateContent): Promise<Template> {
  const template = await editor.create(content);
  props.config.onCreate?.(template);
  initSnapshotHistory();
  websocket.connect(template.id, getWebSocketConfig());
  return template;
}

async function loadTemplate(templateId: string): Promise<Template> {
  const template = await editor.load(templateId);
  props.config.onLoad?.(template);
  initSnapshotHistory();
  websocket.connect(template.id, getWebSocketConfig());
  return template;
}

/**
 * Pre-renders all custom blocks in the content by adding `renderedHtml`
 * so the backend can include them in MJML export output.
 */
async function preRenderCustomBlocks(content: TemplateContent): Promise<void> {
  const renderBlock = async (block: Block): Promise<void> => {
    if (isCustomBlock(block)) {
      const customBlock = block as CustomBlock;
      try {
        customBlock.renderedHtml =
          await registry.renderCustomBlock(customBlock);
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

async function saveTemplate(): Promise<SaveResult> {
  isSaveExporting.value = true;
  try {
    // Pre-render custom blocks so backend can include them in MJML export
    await preRenderCustomBlocks(editor.content.value);

    const template = await editor.save();
    initSnapshotHistory();

    if (snapshotHistoryInstance.value) {
      snapshotHistoryInstance.value.loadSnapshots();
    }

    const exportResult = await exporter.exportHtml(template.id);

    const saveResult: SaveResult = {
      templateId: template.id,
      html: exportResult.html,
      mjml: exportResult.mjml,
      content: template.content,
    };

    props.config.onSave?.(saveResult);

    return saveResult;
  } finally {
    isSaveExporting.value = false;
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

useEventListener(document, "keydown", handleKeydown);

onMounted(() => {
  isMac.value = navigator.platform.toUpperCase().includes("MAC");
  initialize();
});

onUnmounted(() => {
  websocket.disconnect();
  history.destroy();
  autoSave.destroy();
  props.config.onUnmount?.();
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

defineExpose({
  getContent: () => editor.content.value,
  setContent: (content: TemplateContent) => editor.setContent(content),
  setTheme,
  create: createTemplate,
  load: loadTemplate,
  save: saveTemplate,
  sendTestEmail: testEmail.sendTestEmail,
});
</script>

<template>
  <div
    class="tpl tpl:relative tpl:h-full tpl:overflow-hidden"
    :style="themeStyles"
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
      <div
        v-if="isInitializing || editor.state.isLoading"
        class="tpl-loading tpl:absolute tpl:inset-0 tpl:z-[100] tpl:flex tpl:flex-col"
        style="background-color: var(--tpl-bg)"
      >
        <!-- Skeleton header -->
        <div
          class="tpl:flex tpl:h-14 tpl:shrink-0 tpl:items-center tpl:justify-between tpl:px-4"
          style="border-bottom: 1px solid var(--tpl-border)"
        >
          <div
            class="tpl-shimmer tpl:h-5 tpl:w-28 tpl:rounded-[var(--tpl-radius-sm)]"
          ></div>
          <div class="tpl:flex tpl:gap-3">
            <div
              class="tpl-shimmer tpl:h-8 tpl:w-20 tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
            <div
              class="tpl-shimmer tpl:h-8 tpl:w-20 tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
          </div>
        </div>
        <!-- Skeleton body -->
        <div class="tpl:flex tpl:flex-1 tpl:overflow-hidden">
          <!-- Left sidebar rail -->
          <div
            class="tpl:flex tpl:w-12 tpl:shrink-0 tpl:flex-col tpl:items-center tpl:gap-4 tpl:py-5"
            style="border-right: 1px solid var(--tpl-border)"
          >
            <div
              v-for="n in 5"
              :key="n"
              class="tpl-shimmer tpl:size-7 tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
          </div>
          <!-- Canvas area -->
          <div
            class="tpl:flex tpl:flex-1 tpl:items-start tpl:justify-center tpl:overflow-auto tpl:p-8"
            style="background-color: var(--tpl-canvas-bg)"
          >
            <div
              class="tpl:w-full tpl:max-w-[600px] tpl:rounded-[var(--tpl-radius)] tpl:p-6"
              style="
                background-color: var(--tpl-bg);
                box-shadow: var(--tpl-shadow-sm);
              "
            >
              <div class="tpl:space-y-2 tpl:py-4">
                <div class="tpl-shimmer tpl:h-3 tpl:w-3/4 tpl:rounded"></div>
                <div class="tpl-shimmer tpl:h-3 tpl:w-full tpl:rounded"></div>
                <div class="tpl-shimmer tpl:h-3 tpl:w-5/6 tpl:rounded"></div>
              </div>
              <div class="tpl:py-4">
                <div
                  class="tpl-shimmer tpl:h-44 tpl:w-full tpl:rounded-[var(--tpl-radius-sm)]"
                ></div>
              </div>
              <div class="tpl:space-y-2 tpl:py-4">
                <div class="tpl-shimmer tpl:h-3 tpl:w-full tpl:rounded"></div>
                <div class="tpl-shimmer tpl:h-3 tpl:w-2/3 tpl:rounded"></div>
              </div>
              <div class="tpl:flex tpl:justify-center tpl:py-4">
                <div
                  class="tpl-shimmer tpl:h-10 tpl:w-36 tpl:rounded-[var(--tpl-radius-sm)]"
                ></div>
              </div>
              <div class="tpl:space-y-2 tpl:py-4">
                <div
                  class="tpl-shimmer tpl:mx-auto tpl:h-2.5 tpl:w-1/2 tpl:rounded"
                ></div>
                <div
                  class="tpl-shimmer tpl:mx-auto tpl:h-2.5 tpl:w-1/3 tpl:rounded"
                ></div>
              </div>
            </div>
          </div>
          <!-- Right panel -->
          <div
            class="tpl:flex tpl:w-[320px] tpl:shrink-0 tpl:flex-col tpl:gap-4 tpl:p-4"
            style="border-left: 1px solid var(--tpl-border)"
          >
            <div
              class="tpl-shimmer tpl:h-8 tpl:rounded-[var(--tpl-radius-sm)]"
            ></div>
            <div
              class="tpl-shimmer tpl:h-32 tpl:rounded-[var(--tpl-radius)]"
            ></div>
            <div
              class="tpl-shimmer tpl:h-32 tpl:rounded-[var(--tpl-radius)]"
            ></div>
          </div>
        </div>
      </div>
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
      <div
        v-if="initError && !isInitializing"
        role="alert"
        class="tpl-error tpl:absolute tpl:inset-0 tpl:z-[100] tpl:flex tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-6 tpl:px-8"
        style="background-color: var(--tpl-bg)"
      >
        <div
          class="tpl:flex tpl:size-16 tpl:items-center tpl:justify-center tpl:rounded-full"
          style="background-color: var(--tpl-danger-light)"
        >
          <AlertCircle
            :size="32"
            :stroke-width="1.5"
            style="color: var(--tpl-danger)"
          />
        </div>
        <div
          class="tpl:flex tpl:flex-col tpl:items-center tpl:gap-2 tpl:text-center"
        >
          <h2
            class="tpl:text-lg tpl:font-semibold"
            style="color: var(--tpl-text)"
          >
            {{ t.error.title }}
          </h2>
          <p
            class="tpl:max-w-md tpl:text-sm"
            style="color: var(--tpl-text-muted)"
          >
            {{ getErrorMessage(initError) }}
          </p>
        </div>
        <button
          v-if="!isNotFoundError(initError)"
          class="tpl-btn tpl-btn-primary tpl:inline-flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:font-medium tpl:shadow-xs tpl:transition-all tpl:duration-150 tpl:hover:opacity-90"
          style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
          @click="initialize"
        >
          {{ t.error.retry }}
        </button>
      </div>
    </Transition>

    <!-- Header -->
    <header
      class="tpl-header tpl:absolute tpl:top-0 tpl:right-0 tpl:left-0 tpl:z-50 tpl:flex tpl:h-14 tpl:items-center tpl:justify-between tpl:px-4"
      style="
        background-color: color-mix(in srgb, var(--tpl-bg) 80%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: var(--tpl-shadow-md);
      "
    >
      <!-- Left: Logo + template count -->
      <div
        class="tpl-header-left tpl:flex tpl:min-w-[200px] tpl:items-center tpl:gap-3"
      >
        <div
          v-if="!isWhiteLabeled"
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
          <span style="letter-spacing: -0.01em">{{ t.header.title }}</span>
        </div>
        <span
          v-if="templateLimit !== null"
          class="tpl:text-xs tpl:opacity-60"
          style="color: var(--tpl-text-muted)"
        >
          {{
            format(t.header.templatesUsed, {
              used: templateCount,
              max: templateLimit,
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
          v-if="snapshotHistoryInstance"
          :snapshots="snapshotHistorySnapshots"
          :is-loading="snapshotHistoryIsLoading"
          :is-restoring="snapshotHistoryIsRestoring"
          @load="loadSnapshotHistory"
          @navigate="handleSnapshotNavigate"
        />
      </div>

      <!-- Right: Cloud actions -->
      <div
        class="tpl-header-right tpl:flex tpl:min-w-[200px] tpl:items-center tpl:justify-end tpl:gap-3"
      >
        <div
          v-if="editor.state.isDirty"
          aria-live="polite"
          class="tpl-status tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-xs"
          style="color: var(--tpl-text-muted)"
        >
          <span
            class="tpl-pulse tpl:size-1.5 tpl:rounded-full"
            style="background-color: var(--tpl-primary)"
          ></span>
          {{ t.header.unsaved }}
        </div>

        <!-- Comments button -->
        <button
          v-if="commentsInstance.isEnabled.value && hasTemplateSaved"
          :aria-label="
            commentsInstance.unresolvedCount.value > 0
              ? `${t.comments.button} (${commentsInstance.unresolvedCount.value})`
              : t.comments.button
          "
          :aria-expanded="commentsOpen"
          class="tpl-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3.5 tpl:py-2 tpl:text-sm tpl:font-medium tpl:whitespace-nowrap tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-primary)] hover:tpl:text-white tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
          :style="{
            backgroundColor: commentsOpen
              ? 'var(--tpl-primary)'
              : 'transparent',
            color: commentsOpen ? 'var(--tpl-bg)' : 'var(--tpl-primary)',
            borderColor: 'var(--tpl-primary)',
          }"
          @click="commentsOpen = !commentsOpen"
        >
          <MessageCircle :size="16" :stroke-width="2" />
          {{ t.comments.button }}
          <span
            v-if="commentsInstance.unresolvedCount.value > 0 && !commentsOpen"
            class="tpl:inline-flex tpl:size-4.5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold"
            style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
          >
            {{ commentsInstance.unresolvedCount.value }}
          </span>
        </button>

        <!-- AI button + menu -->
        <div
          v-if="canUseAiGeneration && hasTemplateSaved"
          ref="aiMenuRef"
          class="tpl:relative"
        >
          <button
            :aria-expanded="aiMenuOpen"
            class="tpl-ai-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border-none tpl:px-4 tpl:py-2 tpl:text-sm tpl:font-semibold tpl:whitespace-nowrap tpl:transition-all tpl:duration-200"
            :class="aiButtonActive ? 'tpl-ai-btn--active' : 'tpl-ai-btn--idle'"
            @click.stop="toggleAiMenu"
          >
            <Sparkles :size="16" :stroke-width="2" class="tpl-ai-btn-icon" />
            {{ t.aiChat.button }}
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
              v-if="aiMenuOpen"
              class="tpl:absolute tpl:right-0 tpl:top-full tpl:z-50 tpl:mt-1 tpl:origin-top-right"
            >
              <AiFeatureMenu
                :active-feature="activeAiFeature"
                @select="handleAiFeatureSelect"
              />
            </div>
          </Transition>
        </div>

        <!-- Test email button -->
        <button
          v-if="testEmail.isEnabled.value && canSendTestEmail"
          class="tpl-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3.5 tpl:py-2 tpl:text-sm tpl:font-medium tpl:whitespace-nowrap tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-primary)] hover:tpl:text-white tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
          style="
            background-color: transparent;
            color: var(--tpl-primary);
            border-color: var(--tpl-primary);
          "
          :disabled="testEmail.isSending.value || !hasTemplateSaved"
          @click="testEmailModalOpen = true"
        >
          <Send
            v-if="!testEmail.isSending.value"
            :size="16"
            :stroke-width="2"
          />
          <Loader2 v-else class="tpl-spinner" :size="16" :stroke-width="2" />
          {{ t.testEmail.button }}
        </button>

        <!-- Save button -->
        <button
          class="tpl-btn tpl:inline-flex tpl:items-center tpl:gap-1.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:border tpl:px-3.5 tpl:py-2 tpl:text-sm tpl:font-medium tpl:whitespace-nowrap tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] hover:tpl:bg-[var(--tpl-primary)] hover:tpl:text-white tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50"
          style="
            background-color: transparent;
            color: var(--tpl-primary);
            border-color: var(--tpl-primary);
          "
          :disabled="
            editor.state.isSaving || isSaveExporting || !editor.state.isDirty
          "
          @click="saveTemplate()"
        >
          <Save
            v-if="!editor.state.isSaving && !isSaveExporting"
            :size="16"
            :stroke-width="2"
          />
          <Loader2 v-else class="tpl-spinner" :size="16" :stroke-width="2" />
          {{
            editor.state.isSaving || isSaveExporting
              ? t.header.saving
              : t.header.save
          }}
        </button>
      </div>
    </header>

    <!-- Snapshot preview banner -->
    <div
      v-if="isPreviewingSnapshot"
      class="tpl-preview-banner tpl:absolute tpl:top-14 tpl:right-0 tpl:left-0 tpl:z-40 tpl:flex tpl:items-center tpl:justify-center tpl:gap-4 tpl:px-4 tpl:py-3"
      style="
        background-color: var(--tpl-primary-light);
        border-bottom: 1px solid var(--tpl-primary);
      "
    >
      <div
        class="tpl:flex tpl:items-center tpl:gap-2 tpl:text-sm"
        style="color: var(--tpl-text)"
      >
        <Clock :size="18" :stroke-width="2" style="color: var(--tpl-primary)" />
        <span>{{ t.snapshotPreview.message }}</span>
      </div>
      <div class="tpl:flex tpl:items-center tpl:gap-2">
        <button
          class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150"
          style="
            background-color: transparent;
            color: var(--tpl-text-muted);
            border: 1px solid var(--tpl-border);
          "
          @click="cancelPreview"
        >
          {{ t.snapshotPreview.cancel }}
        </button>
        <button
          class="tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm tpl:font-medium tpl:transition-all tpl:duration-150 tpl:hover:opacity-90"
          style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
          @click="confirmRestoreSnapshot"
        >
          {{ t.snapshotPreview.restore }}
        </button>
      </div>
    </div>

    <!-- Collaboration undo warning toast -->
    <Transition
      enter-active-class="tpl:transition-all tpl:duration-200 tpl:ease-out"
      enter-from-class="tpl:translate-y-[-8px] tpl:opacity-0"
      enter-to-class="tpl:translate-y-0 tpl:opacity-100"
      leave-active-class="tpl:transition-all tpl:duration-300 tpl:ease-in"
      leave-from-class="tpl:translate-y-0 tpl:opacity-100"
      leave-to-class="tpl:translate-y-[-8px] tpl:opacity-0"
    >
      <div
        v-if="collabUndoWarningVisible"
        role="status"
        aria-live="polite"
        class="tpl:absolute tpl:top-16 tpl:left-1/2 tpl:z-[60] tpl:-translate-x-1/2 tpl:rounded-[var(--tpl-radius)] tpl:px-4 tpl:py-2.5 tpl:text-sm tpl:shadow-lg"
        style="
          background-color: var(--tpl-warning-light);
          color: var(--tpl-text);
          border: 1px solid var(--tpl-warning);
        "
      >
        {{ t.history.collabWarning }}
      </div>
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
          : rightPanelOpen
            ? 'tpl:left-12 tpl:right-[680px]'
            : 'tpl:left-12 tpl:right-[320px]',
        isPreviewingSnapshot ? 'tpl:top-[104px]' : 'tpl:top-14',
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
            {{ t.blockSettings.restoreHiddenBlocks }}
          </button>
        </Transition>
      </div>
      <main class="tpl-main tpl:flex tpl:min-h-full tpl:justify-center tpl:p-8">
        <Canvas
          :viewport="editor.state.viewport"
          :content="editor.content.value"
          :selected-block-id="editor.state.selectedBlockId"
          :dark-mode="editor.state.darkMode"
          :preview-mode="editor.state.previewMode"
          :locked-blocks="collaboration?.lockedBlocks.value ?? undefined"
          @select-block="editor.selectBlock"
          @open-ai-chat="aiChatOpen = true"
          @open-design-reference="designReferenceOpen = true"
        />
      </main>
    </div>

    <!-- Right sidebar -->
    <RightSidebar
      v-show="!editor.state.previewMode"
      :selected-block="editor.selectedBlock.value"
      :settings="editor.content.value.settings"
      :shifted-left="rightPanelOpen"
      @update-block="
        (updates) => editor.updateBlock(editor.selectedBlock.value!.id, updates)
      "
      @delete-block="blockActions.deleteBlock(editor.selectedBlock.value!.id)"
      @duplicate-block="
        blockActions.duplicateBlock(editor.selectedBlock.value!)
      "
      @update-settings="editor.updateSettings"
    />

    <!-- Cloud sidebars + modals — only mount after cloud init completes -->
    <template v-if="!isInitializing && isAuthReady">
      <AiChatSidebar
        :visible="aiChatOpen"
        :on-apply="
          (content: TemplateContent) => {
            history.record();
            editor.setContent(content);
            conditionPreview.reset();
          }
        "
        @close="aiChatOpen = false"
      />

      <TemplateScoringPanel
        :visible="scoringPanelOpen"
        @close="scoringPanelOpen = false"
      />

      <DesignReferenceSidebar
        :visible="designReferenceOpen"
        :has-existing-blocks="editor.content.value.blocks.length > 0"
        @close="designReferenceOpen = false"
        @apply="
          (content: TemplateContent) => {
            history.record();
            editor.setContent(content);
            conditionPreview.reset();
          }
        "
      />

      <CommentsSidebar
        ref="commentsSidebarRef"
        :visible="commentsOpen"
        @close="commentsOpen = false"
      />

      <TestEmailModal
        :visible="testEmailModalOpen"
        :allowed-emails="testEmail.allowedEmails.value"
        :is-sending="testEmail.isSending.value"
        :error="testEmail.error.value"
        @send="handleSendTestEmail"
        @close="testEmailModalOpen = false"
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
        :visible="mediaLibraryOpen"
        :accept="mediaLibraryAccept"
        @select="handleMediaSelect"
        @close="handleMediaLibraryClose"
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
