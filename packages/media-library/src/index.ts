// Types
export type {
  MediaCategory,
  MediaCategoryData,
  MediaConfig,
  MediaConversion,
  MediaItem,
  MediaFolder,
  MediaBrowseParams,
  MediaBrowseResponse,
  MediaUsageInfo,
  MediaUsageResponse,
  MediaRequestContext,
  StorageInfo,
} from "./types";

// Composable
export { useMediaLibrary } from "./composable";
export type { MediaViewMode, UseMediaLibraryOptions } from "./composable";

// API Client
export { MediaApiClient } from "./api-client";

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
