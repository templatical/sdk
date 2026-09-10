// Types — the contract lives in `@templatical/types`. Re-exported so a
// media-library consumer does not also have to import types for the
// shapes the modal and composable return.
export type {
  MediaAsset,
  MediaCategory,
  MediaFolder,
  MediaRequestContext,
  MediaResult,
  MediaUsageInfo,
} from "./types";

// Composable
export { useMediaLibrary } from "./composable";
export type { MediaViewMode, UseMediaLibraryOptions } from "./composable";

// Vue Components
export { default as MediaLibraryModal } from "./components/MediaLibraryModal.vue";

// Composables
export { useMediaCategories } from "./composables/useMediaCategories";
export type { UseMediaCategoriesReturn } from "./composables/useMediaCategories";
export { useMediaPicker } from "./composables/useMediaPicker";
export { useI18n } from "./composables/useI18n";

// Standalone
export { init, unmount } from "./standalone/visual";
export type {
  MediaLibraryConfig,
  MediaLibraryInstance,
} from "./standalone/types";
