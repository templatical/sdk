import type { ComputedRef, Ref } from "vue";
import type {
  AuthManager,
  UseCollaborationReturn,
  UsePlanConfigReturn,
  UseWebSocketReturn,
} from "@templatical/core/cloud";
import type { McpOperationPayload } from "@templatical/types";

import type { UseEditorReturn } from "@templatical/core";

import type { OnRequestMedia } from "../index";
import type { UseEditorCoreReturn } from "../composables/useEditorCore";
import type { EditorCapabilities } from "../types/editor-capabilities";
import type { UseCloudFeatureFlagsReturn } from "./composables/useCloudFeatureFlags";
import type { UseCloudPanelStateReturn } from "./composables/useCloudPanelState";
import type { UseCloudMediaLibraryReturn } from "./composables/useCloudMediaLibrary";
import type { UseCloudSaveGateReturn } from "./composables/useCloudSaveGate";
import type { UseCollabUndoWarningReturn } from "./composables/useCollabUndoWarning";

/** Collaboration plus the two internals the broadcast wiring reaches for. */
export type CloudCollaborationInstance = UseCollaborationReturn & {
  _broadcastOperation: (payload: McpOperationPayload) => void;
  _isProcessingRemoteOperation: () => boolean;
};

/**
 * **This file is the seam the `initCloud()` collapse rests on, and it is
 * type-only on purpose.**
 *
 * `Editor.vue` is the one editor component. It `import type`s from here and never
 * imports the implementation, so no cloud module is statically reachable from the
 * OSS entry. `initCloud()` dynamically `import()`s `createCloudRuntime` and hands
 * the result to `init()`; an OSS consumer downloads none of it.
 *
 * The two hooks exist because a handful of Cloud composables have to run at
 * specific points *inside* `Editor.vue`'s `setup()`:
 *
 * - {@link CloudRuntime.attach} — after `useEditor()`, before `useEditorCore()`.
 *   Collaboration wraps the editor's mutators to broadcast them, and the history
 *   interceptor must wrap *after* that, or remote operations push local history
 *   entries and the two peers drift.
 * - {@link CloudRuntime.ready} — right after `useEditorCore()`, because the lint
 *   save-gate reads `core.templateLint` and the undo warning reads
 *   `core.history.canUndo`.
 *
 * Everything that does *not* need the editor — the auth manager, the plan config,
 * and every provider built on them — is constructed by `initCloud()` before the
 * mount and arrives through the ordinary `init()` config keys.
 */
export interface CloudRuntime {
  /**
   * Collaboration's locked-block map, forward-declared because `useEditor` takes
   * it at construction while `useCollaboration` (which fills it) can only be
   * built afterwards.
   */
  lockedBlocks: Ref<Map<string, unknown>>;

  /**
   * Cloud's media browser, standing in for the consumer's `onRequestMedia`. Not
   * plan-gated: an entitlement here would fire when a consumer is *not* using
   * Cloud's storage, i.e. backwards.
   */
  onRequestMedia: OnRequestMedia;

  /** Whether the plan grants `saved_modules` — or `true` for a BYO provider. */
  isSavedBlocksAvailable: () => boolean;
  /** Folds the plan feature, the signed allowlist and "a template exists". */
  isTestEmailAvailable: () => boolean;
  /**
   * Folds the `commenting` plan feature, the consumer's `commenting: false`, and
   * "the template is saved" — Cloud anchors a comment server-side. Whether a
   * `user` exists is the shared feature's own gate, not this one's.
   */
  isCommentsAvailable: () => boolean;
  /**
   * Whether a block id exists in the **saved** template, so the comments panel can
   * say "save first" instead of showing an empty thread list for a block the server
   * has never seen. What is left of the deleted Cloud editor core's `savedBlockIds`.
   */
  isBlockSaved: (blockId: string) => boolean;

  /**
   * Cloud's lint save-gate, read through a getter because it is built in
   * {@link ready} while `useTemplatesFeature` — which routes the header's Save
   * and Cmd+S through it — is built before `useEditorCore()`.
   *
   * Returns `null` until then, which the shared feature reads as "no gate".
   */
  getSaveGate: () => UseCloudSaveGateReturn | null;

  /** Collab-aware history: suppresses recording while a remote op is applied. */
  isRemoteOperation: () => boolean;
  /** Warns before an undo that could clobber a collaborator's edit. */
  onBeforeUndo: () => void;

  attach(context: CloudAttachContext): CloudAttachment;
  ready(context: CloudReadyContext): CloudReady;
  /** Torn down before `core.destroy()`; closes the websocket. */
  destroy(): void;
}

export interface CloudAttachContext {
  /**
   * The one editor core, shared by both entry points: `useCollaboration`,
   * `useMcpListener` and the broadcast wrapper all take this.
   */
  editor: UseEditorReturn;
}

/** What {@link CloudRuntime.attach} builds — everything that needs the editor. */
export interface CloudAttachment {
  websocket: UseWebSocketReturn;
  panelState: UseCloudPanelStateReturn;
  mediaLib: UseCloudMediaLibraryReturn;
  /**
   * The three values `@templatical/media-library`'s `MediaLibraryModal` needs,
   * carried here so `CloudPanels` can bind them as **props**.
   *
   * Props rather than injection: Vue matches injection keys by identity, so a key
   * the modal and the editor spell differently resolves to `undefined` silently
   * and the media browser opens inert. Props make the boundary a compile-time
   * contract; nothing outside this package injects them.
   */
  mediaBrowser: CloudMediaBrowserContext;
  featureFlags: UseCloudFeatureFlagsReturn;
  collaboration: CloudCollaborationInstance | null;
  isCollaborationEnabled: ComputedRef<boolean>;
}

export interface CloudMediaBrowserContext {
  authManager: AuthManager;
  /** Scopes every media request. Fixed for the session by the JWT. */
  projectId: string;
  /** Media limits and the storage gauge, read reactively inside the modal. */
  planConfig: UsePlanConfigReturn;
}

export interface CloudReadyContext {
  core: UseEditorCoreReturn;
  /**
   * The same object `useEditorCore` was handed and provided, mutated in place so
   * Cloud's entries (plan, ai, comments) reach components on their first render —
   * the pattern `versionHistory` already uses in `Editor.vue`.
   */
  capabilities: EditorCapabilities;
}

/** What {@link CloudRuntime.ready} builds — everything that needs `core`. */
export interface CloudReady {
  saveGate: UseCloudSaveGateReturn;
  collabWarning: UseCollabUndoWarningReturn;
  /** Session-level failure (auth expiring mid-session), shown over the editor. */
  sessionError: Ref<Error | null>;
  /** Re-runs the auth handshake and clears {@link sessionError} on success. */
  retry: () => Promise<void>;
}
