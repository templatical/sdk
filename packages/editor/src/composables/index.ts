export { useFocusTrap } from "./useFocusTrap";
export { useI18n, type UseI18nReturn } from "./useI18n";
export { useMergeTag, type UseMergeTagReturn } from "./useMergeTag";
export {
  useEmoji,
  type EmojiCategory,
  type EmojiCategoryKey,
} from "./useEmoji";
export {
  useBlockRegistry,
  type BlockRegistration,
  type SidebarItem,
  type UseBlockRegistryReturn,
} from "./useBlockRegistry";
export {
  useDragDrop,
  type UseDragDropOptions,
  type UseDragDropReturn,
} from "./useDragDrop";

export { useFonts, type FontOption, type UseFontsReturn } from "./useFonts";
export { useThemeStyles, type UseThemeStylesOptions } from "./useThemeStyles";
export {
  useRichTextEditor,
  type UseRichTextEditorOptions,
  type UseRichTextEditorReturn,
} from "./useRichTextEditor";

// Re-export core composables for convenience
export type { UseEditorReturn } from "@templatical/core";
export type { UseBlockActionsReturn } from "@templatical/core";
export type { UseConditionPreviewReturn } from "@templatical/core";
