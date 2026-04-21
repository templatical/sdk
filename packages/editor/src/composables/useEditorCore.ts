import {
  computed,
  provide,
  ref,
  watch,
  type Component,
  type ComputedRef,
  type DeepReadonly,
  type Ref,
} from "vue";
import { useEventListener } from "@vueuse/core";
import {
  useHistory,
  useHistoryInterceptor,
  useBlockActions,
  useAutoSave,
  useConditionPreview,
} from "@templatical/core";
import type {
  UseHistoryReturn,
  UseBlockActionsReturn,
  UseConditionPreviewReturn,
  UseAutoSaveReturn,
} from "@templatical/core";
import type { UseEditorReturn as CoreUseEditorReturn } from "@templatical/core";
import type {
  Block,
  BlockDefaults,
  CustomBlockDefinition,
  DisplayConditionsConfig,
  MergeTagsConfig,
  TemplateContent,
  TemplateSettings,
  ThemeOverrides,
  UiTheme,
  ViewportSize,
} from "@templatical/types";
import { resolveSyntax } from "@templatical/types";
import type { Translations } from "../i18n";
import type { OnRequestMedia } from "../index";
import type { EditorCapabilities } from "../types/editor-capabilities";
import {
  TRANSLATIONS_KEY,
  EDITOR_KEY,
  HISTORY_KEY,
  BLOCK_ACTIONS_KEY,
  CONDITION_PREVIEW_KEY,
  FONTS_MANAGER_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  BLOCK_DEFAULTS_KEY,
  BLOCK_REGISTRY_KEY,
  CUSTOM_BLOCK_DEFINITIONS_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  ON_REQUEST_MEDIA_KEY,
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  CAPABILITIES_KEY,
  KEYBOARD_REORDER_KEY,
} from "../keys";
import type { UseFontsReturn } from "./useFonts";
import { useI18n, type UseI18nReturn } from "./useI18n";
import {
  useKeyboardReorder,
  type UseKeyboardReorderReturn,
} from "./useKeyboardReorder";
import { useUiTheme } from "./useUiTheme";
import { useThemeStyles } from "./useThemeStyles";
import {
  useBlockRegistry,
  type UseBlockRegistryReturn,
} from "./useBlockRegistry";
import { registerBuiltInBlocks } from "../utils/registerBuiltInBlocks";
import { handleEditorKeydown } from "../utils/keyboardShortcuts";

// Block components — shared between OSS and Cloud editors
import ButtonBlock from "../components/blocks/ButtonBlock.vue";
import CountdownBlockComponent from "../components/blocks/CountdownBlock.vue";
import CustomBlockComponent from "../components/blocks/CustomBlock.vue";
import DividerBlock from "../components/blocks/DividerBlock.vue";
import HtmlBlock from "../components/blocks/HtmlBlock.vue";
import ImageBlock from "../components/blocks/ImageBlock.vue";
import MenuBlock from "../components/blocks/MenuBlock.vue";
import ParagraphBlock from "../components/blocks/ParagraphBlock.vue";
import SectionBlock from "../components/blocks/SectionBlock.vue";
import SocialIconsBlock from "../components/blocks/SocialIconsBlock.vue";
import SpacerBlock from "../components/blocks/SpacerBlock.vue";
import TableBlock from "../components/blocks/TableBlock.vue";
import TitleBlock from "../components/blocks/TitleBlock.vue";
import VideoBlock from "../components/blocks/VideoBlock.vue";

const BLOCK_COMPONENT_MAP: Record<string, Component> = {
  section: SectionBlock,
  title: TitleBlock,
  paragraph: ParagraphBlock,
  image: ImageBlock,
  button: ButtonBlock,
  divider: DividerBlock,
  video: VideoBlock,
  social: SocialIconsBlock,
  menu: MenuBlock,
  table: TableBlock,
  spacer: SpacerBlock,
  html: HtmlBlock,
  countdown: CountdownBlockComponent,
};

/**
 * Minimal editor interface shared by both OSS and Cloud UseEditorReturn.
 * Cloud adds extra methods (create, load, save, etc.) that useEditorCore doesn't need.
 */
export interface BaseEditorReturn {
  state: DeepReadonly<{
    content: TemplateContent;
    selectedBlockId: string | null;
    viewport: ViewportSize;
    darkMode: boolean;
    previewMode: boolean;
    uiTheme: UiTheme;
    isDirty: boolean;
    template?: { id: string } | null;
    isLoading?: boolean;
    isSaving?: boolean;
  }>;
  content: Ref<TemplateContent>;
  selectedBlock: Ref<Block | null>;
  savedBlockIds?: Ref<Set<string>>;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
  selectBlock: (blockId: string | null) => void;
  setViewport: (viewport: ViewportSize) => void;
  setDarkMode: (darkMode: boolean) => void;
  setPreviewMode: (previewMode: boolean) => void;
  setUiTheme: (theme: UiTheme) => void;
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  updateSettings: (updates: Partial<TemplateSettings>) => void;
  addBlock: (
    block: Block,
    targetSectionId?: string,
    columnIndex?: number,
    index?: number,
  ) => void;
  removeBlock: (blockId: string) => void;
  moveBlock: (
    blockId: string,
    newIndex: number,
    targetSectionId?: string,
    columnIndex?: number,
  ) => void;
  isBlockLocked: (blockId: string) => boolean;
  markDirty: () => void;
}

export interface UseEditorCoreOptions {
  editor: BaseEditorReturn;

  config: {
    uiTheme?: UiTheme;
    theme?: ThemeOverrides;
    blockDefaults?: BlockDefaults;
    customBlocks?: CustomBlockDefinition[];
    mergeTags?: MergeTagsConfig;
    displayConditions?: DisplayConditionsConfig;
    onRequestMedia?: OnRequestMedia | null;
    onSave?: () => void;
  };

  translations: Translations;
  fontsManager: UseFontsReturn;

  /** Extra options passed to useHistory (Cloud passes isRemoteOperation) */
  historyOptions?: { isRemoteOperation?: () => boolean };

  /** Auto-save configuration. Pass null to skip auto-save. */
  autoSaveOptions?: {
    onChange: () => void | Promise<void>;
    debounce?: number;
    enabled?: () => boolean;
  } | null;

  /** Extra CSS custom properties merged into theme styles (Cloud uses for drop-zone text) */
  themeExtraStyles?: () => Record<string, string>;

  /** Extra keyboard shortcut hooks (Cloud passes onBeforeUndo for collab warning) */
  keyboardOptions?: { onBeforeUndo?: () => void };

  /** Cloud capabilities exposed to OSS components. Empty in OSS mode. */
  capabilities?: EditorCapabilities;
}

export interface UseEditorCoreReturn {
  t: Translations;
  format: UseI18nReturn["format"];
  history: UseHistoryReturn;
  blockActions: UseBlockActionsReturn;
  conditionPreview: UseConditionPreviewReturn;
  autoSave: UseAutoSaveReturn | null;
  resolvedTheme: ComputedRef<string>;
  themeStyles: ComputedRef<Record<string, string>>;
  themeOverrides: Ref<ThemeOverrides>;
  registry: UseBlockRegistryReturn;
  keyboardReorder: UseKeyboardReorderReturn;
  registerCustomBlocks: (definitions: CustomBlockDefinition[]) => void;
  destroy: () => void;
}

export function useEditorCore(
  options: UseEditorCoreOptions,
): UseEditorCoreReturn {
  const { editor, config, translations, fontsManager } = options;

  // --- i18n ---
  const { t, format } = useI18n(translations);

  // --- UI Theme ---
  editor.setUiTheme(config.uiTheme ?? "auto");
  const uiThemeRef = computed(() => editor.state.uiTheme);
  const { resolvedTheme } = useUiTheme(uiThemeRef);

  // --- Theme styles ---
  const themeOverrides = ref<ThemeOverrides>(config.theme ?? {});
  const { themeStyles } = useThemeStyles({
    themeOverrides,
    resolvedTheme,
    extraStyles: options.themeExtraStyles,
  });

  // --- History ---
  const history = useHistory({
    content: editor.content,
    setContent: (content: TemplateContent, markDirty?: boolean) =>
      editor.setContent(content, markDirty),
    ...options.historyOptions,
  });
  useHistoryInterceptor(editor as unknown as CoreUseEditorReturn, history);

  // --- Block actions ---
  const blockActions = useBlockActions({
    addBlock: editor.addBlock,
    removeBlock: editor.removeBlock,
    updateBlock: editor.updateBlock,
    selectBlock: editor.selectBlock,
    blockDefaults: config.blockDefaults,
  });

  // --- Condition preview ---
  const conditionPreview = useConditionPreview(
    editor as unknown as CoreUseEditorReturn,
  );

  // --- Auto-save ---
  const autoSave =
    options.autoSaveOptions !== null && options.autoSaveOptions !== undefined
      ? useAutoSave({
          content: editor.content,
          isDirty: () => editor.state.isDirty,
          ...options.autoSaveOptions,
        })
      : null;

  // Pause/resume auto-save during history navigation (undo/redo)
  let stopNavigatingWatch: (() => void) | null = null;
  if (autoSave) {
    stopNavigatingWatch = watch(history.isNavigating, (navigating) => {
      if (navigating) {
        autoSave.pause();
      } else {
        autoSave.resume();
      }
    });
  }

  // --- Keyboard reorder (GitHub-style lift/move/drop via keyboard) ---
  const keyboardReorder = useKeyboardReorder(editor, { t, format });

  // --- Block registry ---
  const registry = useBlockRegistry();
  registerBuiltInBlocks(registry, BLOCK_COMPONENT_MAP);

  // Register custom blocks provided at init time (Cloud may defer this to initialize())
  if (config.customBlocks?.length) {
    for (const definition of config.customBlocks) {
      registry.registerCustom(definition, CustomBlockComponent);
    }
  }

  function registerCustomBlocks(definitions: CustomBlockDefinition[]): void {
    for (const definition of definitions) {
      registry.registerCustom(definition, CustomBlockComponent);
    }
  }

  // --- Keyboard shortcuts ---
  function handleKeyboard(e: KeyboardEvent): void {
    handleEditorKeydown(e, {
      history,
      selectBlock: (id) => editor.selectBlock(id),
      getSelectedBlockId: () => editor.state.selectedBlockId,
      removeBlock: (id) => editor.removeBlock(id),
      onSave: config.onSave,
      onBeforeUndo: options.keyboardOptions?.onBeforeUndo,
    });
  }

  useEventListener(document, "keydown", handleKeyboard);

  // --- Provides (18 shared keys) ---
  provide(TRANSLATIONS_KEY, translations);
  provide(EDITOR_KEY, editor);
  provide(HISTORY_KEY, history);
  provide(BLOCK_ACTIONS_KEY, blockActions);
  provide(CONDITION_PREVIEW_KEY, conditionPreview);
  provide(FONTS_MANAGER_KEY, fontsManager);
  provide(THEME_STYLES_KEY, themeStyles);
  provide(UI_THEME_KEY, resolvedTheme);
  provide(BLOCK_DEFAULTS_KEY, config.blockDefaults);
  provide(BLOCK_REGISTRY_KEY, registry);
  provide(CUSTOM_BLOCK_DEFINITIONS_KEY, config.customBlocks ?? []);

  const mergeTagSyntax = resolveSyntax(config.mergeTags?.syntax);
  provide(MERGE_TAGS_KEY, config.mergeTags?.tags ?? []);
  provide(MERGE_TAG_SYNTAX_KEY, mergeTagSyntax);
  provide(ON_REQUEST_MERGE_TAG_KEY, config.mergeTags?.onRequest ?? null);

  provide(ON_REQUEST_MEDIA_KEY, config.onRequestMedia ?? null);

  provide(DISPLAY_CONDITIONS_KEY, config.displayConditions?.conditions ?? []);
  provide(
    ALLOW_CUSTOM_CONDITIONS_KEY,
    config.displayConditions?.allowCustom ?? false,
  );

  // Default empty capabilities for OSS mode.
  // CloudEditor overrides this via provide() after cloud composables are ready.
  provide(CAPABILITIES_KEY, options.capabilities ?? {});

  provide(KEYBOARD_REORDER_KEY, keyboardReorder);

  // --- Cleanup ---
  function destroy(): void {
    stopNavigatingWatch?.();
    autoSave?.destroy();
    history.destroy();
  }

  return {
    t,
    format,
    history,
    blockActions,
    conditionPreview,
    autoSave,
    resolvedTheme,
    themeStyles,
    themeOverrides,
    registry,
    keyboardReorder,
    registerCustomBlocks,
    destroy,
  };
}
