// Editor state
export { useEditor } from "./editor";
export type { EditorState, UseEditorOptions, UseEditorReturn } from "./editor";

// History (undo/redo)
export { useHistory } from "./history";
export type { UseHistoryOptions, UseHistoryReturn } from "./history";

// Block actions
export { useBlockActions } from "./block-actions";
export type {
  UseBlockActionsOptions,
  UseBlockActionsReturn,
} from "./block-actions";

// Auto-save
export { useAutoSave } from "./auto-save";
export type { UseAutoSaveOptions, UseAutoSaveReturn } from "./auto-save";

// Display condition preview
export { useConditionPreview } from "./condition-preview";
export type { UseConditionPreviewReturn } from "./condition-preview";

// Custom block data source fetching
export { useDataSourceFetch } from "./data-source-fetch";

// History interceptor
export { useHistoryInterceptor } from "./history-interceptor";

// Saved blocks (reusable block groups over a consumer-supplied storage provider)
export { useSavedBlocks } from "./saved-blocks";
export type {
  UseSavedBlocksOptions,
  UseSavedBlocksReturn,
} from "./saved-blocks";
export { createLocalStorageSavedBlocksProvider } from "./saved-blocks-local";
export type { LocalStorageSavedBlocksOptions } from "./saved-blocks-local";

// Version history (over a consumer-supplied storage provider)
export { useVersionHistory } from "./version-history";
export type {
  UseVersionHistoryOptions,
  UseVersionHistoryReturn,
} from "./version-history";

// Comments (over a consumer-supplied storage provider). Shared rather than
// cloud-only: Cloud is one adapter behind the same contract, and
// `useCommentListener` wires whatever realtime transport that adapter has, if any.
export { useComments, useCommentListener } from "./comments";
export type {
  UseCommentsOptions,
  UseCommentsReturn,
  UseCommentListenerOptions,
} from "./comments";
