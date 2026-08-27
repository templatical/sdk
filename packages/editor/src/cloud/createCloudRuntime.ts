import { computed, provide, ref, watch } from "vue";
import {
  AuthManager,
  isFatalAuthError,
  performHealthCheck,
  useAiConfig,
  useCollaboration,
  useCollaborationBroadcast,
  useExport,
  useMcpListener,
  usePlanConfig,
  resolveExportFonts,
  resolveWebSocketConfig,
  createCloudCommentsProvider,
  createCloudRenderProvider,
  createCloudSavedBlocksProvider,
  createCloudTemplatesProvider,
  createCloudTestEmailProvider,
  createCloudVersionHistoryProvider,
  useTemplateScoring,
  useTestEmail,
  useWebSocket,
  type RealtimeChannel,
} from "@templatical/core/cloud";
import type { UseEditorReturn } from "@templatical/core";
import type {
  CommentsOptions,
  CommentsProvider,
  EditorUser,
  RenderProvider,
  SavedBlocksOptions,
  SavedBlocksProvider,
  Template,
  TemplateContent,
  TemplatePatch,
  TemplatesOptions,
  TemplatesProvider,
  TestEmailOptions,
  TestEmailProvider,
  VersionHistoryOptions,
  VersionHistoryProvider,
} from "@templatical/types";

import type { CloudTranslations } from "../i18n";
import { preRenderCustomBlocks } from "../utils/preRenderCustomBlocks";
import { logger } from "../utils/logger";
import type { UseEditorCoreReturn } from "../composables/useEditorCore";
import {
  AI_CONFIG_KEY,
  AUTH_MANAGER_KEY,
  CLOUD_TRANSLATIONS_KEY,
  SCORING_KEY,
} from "../keys";

import { useCloudFeatureFlags } from "./composables/useCloudFeatureFlags";
import {
  useCloudMediaLibrary,
  type UseCloudMediaLibraryReturn,
} from "./composables/useCloudMediaLibrary";
import { useCloudPanelState } from "./composables/useCloudPanelState";
import {
  useCloudSaveGate,
  type UseCloudSaveGateReturn,
} from "./composables/useCloudSaveGate";
import {
  useCollabUndoWarning,
  type UseCollabUndoWarningReturn,
} from "./composables/useCollabUndoWarning";
import { collectSavedBlockIds } from "./collectSavedBlockIds";
import type {
  CloudAttachContext,
  CloudAttachment,
  CloudCollaborationInstance,
  CloudReady,
  CloudReadyContext,
  CloudRuntime,
} from "./runtime";
import type { TemplaticalCloudEditorConfig } from "./cloudConfig";

export interface BootstrapCloudOptions {
  config: TemplaticalCloudEditorConfig;
  cloudTranslations: CloudTranslations;
}

/**
 * What {@link bootstrapCloud} hands back: a set of ordinary `init()` config
 * values, plus the runtime for the few things that must run inside the editor
 * component's `setup()`.
 */
export interface CloudBootstrap {
  runtime: CloudRuntime;
  providers: {
    templates: TemplatesProvider;
    render: RenderProvider;
    versionHistory: VersionHistoryProvider;
    /** Absent when `savedBlocks: false` — the feature is then off entirely. */
    savedBlocks?: SavedBlocksProvider;
    testEmail: TestEmailProvider;
    comments: CommentsProvider;
  };
  /**
   * Who is editing, from the JWT — `init({ user })`'s value for a Cloud session.
   *
   * `undefined` when the project's token carries no `user` claim, which makes
   * comments unavailable rather than anonymous. Not a key `initCloud()` accepts:
   * Cloud's comment writes are signed against this same claim, so a
   * consumer-supplied identity would only be able to disagree with it.
   */
  user?: EditorUser;
}

/**
 * Pick only the event members off a consumer-supplied `templates` value.
 *
 * A whitelist, never a spread. The config type says `TemplatesOptions`, but a
 * JavaScript consumer is unchecked, so the object can carry anything —
 * `load`/`create`/`save` are already shadowed by the literal defining them
 * after the spread, and this drops everything else so the guarantee never
 * depends on that ordering surviving a later edit.
 *
 * Each member is also type-checked, not merely truthiness-checked: a value
 * like `onSaved: "yes"` would otherwise reach core and throw at save time,
 * inside a call the consumer never made.
 */
function eventsOf(value: TemplatesOptions | undefined): TemplatesOptions {
  if (!value) return {};
  const { onSaved, onCreated, onLoaded } = value;
  return {
    ...(typeof onSaved === "function" ? { onSaved } : {}),
    ...(typeof onCreated === "function" ? { onCreated } : {}),
    ...(typeof onLoaded === "function" ? { onLoaded } : {}),
  };
}

/**
 * Fails to compile when `TemplatesOptions` gains a member outside the six
 * named below. Cloud picks that object apart by name in two places —
 * `eventsOf` above and `initCloud`'s merge in `index.ts` — so a seventh
 * member forces a **deliberate decision** about which of the two forwards
 * it. The check cannot make that decision itself: adding the new name to the
 * `Exclude` list below satisfies the compiler on its own and forwards
 * nothing by itself, and it has no way to tell an event (belongs in
 * `eventsOf`) from config (belongs in the `index.ts` merge).
 *
 * The type alone checks nothing: TypeScript never evaluates an alias nothing
 * reads, so a `never` result would sit there silently. The assignment below
 * is what forces the check — it fails to compile the moment a member falls
 * outside the six named here.
 */
type _TemplatesOptionsForwarded =
  Exclude<
    keyof TemplatesOptions,
    | "autoSave"
    | "unsavedChangesGuard"
    | "nameField"
    | "onSaved"
    | "onCreated"
    | "onLoaded"
  > extends never
    ? true
    : never;
const _templatesOptionsForwarded: _TemplatesOptionsForwarded = true;

/**
 * Pick only the event members off a consumer-supplied `comments` value.
 *
 * A whitelist, never a spread. The config type says `CommentsOptions`, but a
 * JavaScript consumer is unchecked, so the object can carry anything —
 * `list`/`create`/`update`/`delete`/`setResolved` are already shadowed by the
 * spread of Cloud's own adapter that follows this in the provider literal, and
 * this drops everything else so the guarantee never depends on that ordering
 * surviving a later edit.
 *
 * Each member is also type-checked, not merely truthiness-checked: a value
 * like `onCreated: "yes"` would otherwise reach core and throw at
 * comment-creation time, inside a call the consumer never made.
 */
function commentEventsOf(
  value: false | CommentsOptions | undefined,
): CommentsOptions {
  if (!value) return {};
  const { onCreated, onUpdated, onDeleted, onResolved, onUnresolved } = value;
  return {
    ...(typeof onCreated === "function" ? { onCreated } : {}),
    ...(typeof onUpdated === "function" ? { onUpdated } : {}),
    ...(typeof onDeleted === "function" ? { onDeleted } : {}),
    ...(typeof onResolved === "function" ? { onResolved } : {}),
    ...(typeof onUnresolved === "function" ? { onUnresolved } : {}),
  };
}

/**
 * Fails to compile when `CommentsOptions` gains a member outside the five
 * named below. Every member of `CommentsOptions` is an event, and
 * `commentEventsOf` above is the only place that forwards them — unlike
 * `TemplatesOptions`, there is no second merge in `index.ts`, since comments
 * carries no config booleans for that merge to combine. A sixth member has
 * exactly one place to be added: this list and `commentEventsOf`'s destructure,
 * together.
 *
 * The type alone checks nothing: TypeScript never evaluates an alias nothing
 * reads, so a `never` result would sit there silently. The assignment below is
 * what forces the check — it fails to compile the moment a member falls
 * outside the five named here.
 */
type _CommentsOptionsForwarded =
  Exclude<
    keyof CommentsOptions,
    "onCreated" | "onUpdated" | "onDeleted" | "onResolved" | "onUnresolved"
  > extends never
    ? true
    : never;
const _commentsOptionsForwarded: _CommentsOptionsForwarded = true;

/**
 * Pick only the event members off a consumer-supplied `savedBlocks` value.
 *
 * A whitelist, never a spread. `savedBlocks` accepts a boolean, an
 * events-only `SavedBlocksOptions`, or a full `SavedBlocksProvider` — this is
 * only ever called on the first two, since a full provider replaces Cloud's
 * adapter outright and is used as-is (see `consumerSavedBlocks` below). A
 * non-object value (`true`, `undefined`, `false`) carries no keys to pick, so
 * it returns `{}` rather than throwing on the destructure.
 *
 * Each member is also type-checked, not merely truthiness-checked: a value
 * like `onCreated: "yes"` would otherwise reach core and throw at
 * saved-block-creation time, inside a call the consumer never made.
 */
function savedBlocksEventsOf(
  value: TemplaticalCloudEditorConfig["savedBlocks"],
): SavedBlocksOptions {
  if (typeof value !== "object" || value === null) return {};
  const { onCreated, onUpdated, onDeleted } = value;
  return {
    ...(typeof onCreated === "function" ? { onCreated } : {}),
    ...(typeof onUpdated === "function" ? { onUpdated } : {}),
    ...(typeof onDeleted === "function" ? { onDeleted } : {}),
  };
}

/**
 * Fails to compile when `SavedBlocksOptions` gains a member outside the three
 * named below. `savedBlocksEventsOf` above is the only place that forwards
 * them, so a fourth member has exactly one place to be added: this list and
 * that function's destructure, together.
 *
 * The type alone checks nothing: TypeScript never evaluates an alias nothing
 * reads, so a `never` result would sit there silently. The assignment below
 * is what forces the check — it fails to compile the moment a member falls
 * outside the three named here.
 */
type _SavedBlocksOptionsForwarded =
  Exclude<
    keyof SavedBlocksOptions,
    "onCreated" | "onUpdated" | "onDeleted"
  > extends never
    ? true
    : never;
const _savedBlocksOptionsForwarded: _SavedBlocksOptionsForwarded = true;

/**
 * Pick `onSent` and `defaultRecipient` off a consumer-supplied `testEmail`
 * value.
 *
 * A whitelist, like `savedBlocksEventsOf` — but note what it does NOT pick:
 * `includeMjml` and `allowedRecipients` stay Cloud's own whenever Cloud's
 * sender is in play, so they are never read here even though
 * `TestEmailOptions` declares them (see `_TestEmailOptionsForwarded` below).
 * `defaultRecipient` has no such conflict — Cloud's provider never defines
 * it, and `useTestEmailFeature` already discards a value outside
 * `allowedRecipients`, so a consumer's choice can only ever pre-fill an
 * address already on Cloud's own signed list, never smuggle in one outside
 * it. `onSent` is a plain notification with no conflict either, so both
 * cross over.
 *
 * The result is assigned ONTO Cloud's own provider with `Object.assign`
 * (never spread together with it) at the call site — that provider's
 * `allowedRecipients` is a live getter over the JWT-derived allowlist, and a
 * spread reads every own property through `[[Get]]`, freezing the getter's
 * current value into a plain property on the new object. `Object.assign`
 * with the cloud provider as the *target* only ever writes the keys this
 * function returns, so the getter is never read and never disturbed.
 */
function testEmailEventsOf(
  value: TemplaticalCloudEditorConfig["testEmail"],
): Pick<TestEmailOptions, "onSent" | "defaultRecipient"> {
  if (typeof value !== "object" || value === null) return {};
  const { onSent, defaultRecipient } = value;
  return {
    ...(typeof onSent === "function" ? { onSent } : {}),
    ...(typeof defaultRecipient === "string" ? { defaultRecipient } : {}),
  };
}

/**
 * Fails to compile when `TestEmailOptions` gains a member outside the four
 * named below. `onSent` and `defaultRecipient` are forwarded by
 * `testEmailEventsOf` above; `includeMjml` and `allowedRecipients` stay
 * Cloud's own whenever Cloud's sender is in play (Cloud renders server-side
 * rather than from a client MJML pass, and the allowlist is the signed one
 * from the project's JWT, not a client-supplied one). A fifth member still
 * forces a deliberate decision the same way a fourth `SavedBlocksOptions`
 * member does: whether it joins the forwarded pair or stays excluded for the
 * same reason as the other two.
 *
 * The type alone checks nothing: TypeScript never evaluates an alias nothing
 * reads, so a `never` result would sit there silently. The assignment below
 * is what forces the check — it fails to compile the moment a member falls
 * outside the four named here.
 */
type _TestEmailOptionsForwarded =
  Exclude<
    keyof TestEmailOptions,
    "includeMjml" | "allowedRecipients" | "defaultRecipient" | "onSent"
  > extends never
    ? true
    : never;
const _testEmailOptionsForwarded: _TestEmailOptionsForwarded = true;

/**
 * Pick only the event members off a consumer-supplied `versionHistory`
 * value.
 *
 * A whitelist, never a spread — the config type says `VersionHistoryOptions`,
 * but a JavaScript consumer is unchecked, so the object can carry anything.
 * `versionHistory` never accepts a full provider (see the rejected-keys block
 * below), so unlike `savedBlocksEventsOf` / `testEmailEventsOf` this is
 * always called on the whole config value.
 */
function versionHistoryEventsOf(
  value: VersionHistoryOptions | undefined,
): VersionHistoryOptions {
  if (!value) return {};
  const { onCreated, onRestored } = value;
  return {
    ...(typeof onCreated === "function" ? { onCreated } : {}),
    ...(typeof onRestored === "function" ? { onRestored } : {}),
  };
}

/**
 * Fails to compile when `VersionHistoryOptions` gains a member outside the
 * two named below. `versionHistoryEventsOf` above is the only place that
 * forwards them, so a third member has exactly one place to be added: this
 * list and that function's destructure, together.
 *
 * The type alone checks nothing: TypeScript never evaluates an alias nothing
 * reads, so a `never` result would sit there silently. The assignment below
 * is what forces the check — it fails to compile the moment a member falls
 * outside the two named here.
 */
type _VersionHistoryOptionsForwarded =
  Exclude<keyof VersionHistoryOptions, "onCreated" | "onRestored"> extends never
    ? true
    : never;
const _versionHistoryOptionsForwarded: _VersionHistoryOptionsForwarded = true;

/**
 * A comma list with a final "and" — "a"; "a and b"; "a, b and c". The
 * ignored-methods warnings below each name however many storage methods a
 * consumer actually passed, and `Array.join(" and ")` only reads correctly
 * for exactly two.
 */
function joinWithAnd(items: string[]): string {
  if (items.length < 2) return items.join("");
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Cloud's bootstrap and adapter wiring, in one place, run **before the editor
 * mounts**.
 *
 * This replaces `useCloudInitialization`, which owned a second `useEditor`, a
 * second `useEditorCore` and a post-mount async dance with its own loading and
 * error states. The dance is gone: auth, the health check and the plan fetch all
 * resolve here, and a failure rejects `initCloud()` rather than mounting an
 * editor that cannot work. What is left is adapter construction.
 *
 * Two things deliberately stay Cloud-only:
 *
 * - **Entitlements.** In an all-BYO world there are no plans, so `planConfig` is
 *   Cloud's commercial layer above the provider set rather than a provider
 *   itself. It is down to five booleans, each metering a resource Cloud buys.
 * - **Mid-session failure.** `init()` cannot fail after it mounts and should not
 *   grow the ability, so the error overlay lives on this side of the seam.
 */
export async function bootstrapCloud(
  options: BootstrapCloudOptions,
): Promise<CloudBootstrap> {
  const { config, cloudTranslations } = options;

  // --- Late-bound editor access ---------------------------------------------
  //
  // The providers below are built before there is an editor to read. Each
  // reaches it through these holders, filled by `attach()` / `ready()` — which is
  // what lets them be handed to `init()` as ordinary config keys.
  let editorRef: UseEditorReturn | null = null;
  let coreRef: UseEditorCoreReturn | null = null;
  let websocketRef: ReturnType<typeof useWebSocket> | null = null;
  let mediaLibRef: UseCloudMediaLibraryReturn | null = null;
  let collaboration: CloudCollaborationInstance | null = null;
  let collabWarning: UseCollabUndoWarningReturn | null = null;
  let saveGate: UseCloudSaveGateReturn | null = null;

  const sessionError = ref<Error | null>(null);
  const lockedBlocks = ref<Map<string, unknown>>(new Map());
  /**
   * Cloud's presence channel, forward-declared for the comments adapter's
   * `subscribe`. `useWebSocket` can only be built in `attach()` (it needs the
   * editor), while the provider is handed to `init()` before that — so the adapter
   * watches this and rebinds when the real channel lands.
   */
  const commentChannel = ref<RealtimeChannel | null>(null);

  function requireEditor(): UseEditorReturn {
    if (!editorRef) {
      throw new Error("[Templatical] The Cloud editor is not mounted yet.");
    }
    return editorRef;
  }

  function getTemplateId(): string | null {
    return editorRef?.state.template?.id ?? null;
  }

  // --- Auth + plan ----------------------------------------------------------

  const authManager = new AuthManager({
    ...config.auth,
    // Only a *fatal* refusal raises the overlay. A 4xx means the endpoint
    // rejected the credentials, so every subsequent request fails the same way
    // and the session really is over. A network blip or a 5xx resolves on its
    // own, and blanking a mounted editor over one interrupts someone mid-edit on
    // a template that is probably unsaved — a worse outcome than the blip.
    //
    // The consumer hears about both: `onError` fires either way, and
    // `AuthManager` re-throws regardless, so a caller that cannot proceed still
    // finds out.
    onError: (error: Error) => {
      if (isFatalAuthError(error)) {
        sessionError.value = error;
      }
      config.onError?.(error);
    },
  });

  const planConfigInstance = usePlanConfig({
    authManager,
    onError: config.onError,
  });

  await authManager.initialize();

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
    logger.warn(
      "WebSocket health check failed:",
      healthResult.websocket.error ?? "unknown error",
      "-- real-time features will be disabled.",
    );
  }

  await planConfigInstance.fetchConfig();

  // The bootstrap itself is what the overlay would have covered, and it just
  // succeeded — so anything `onError` recorded on the way here is stale.
  sessionError.value = null;

  // --- Rejected consumer keys ----------------------------------------------
  //
  // `render` is not declared on `TemplaticalCloudEditorConfig`, so it only
  // fires for JavaScript consumers — warned rather than silently dropped,
  // because the symptom (a store that stays empty while Cloud's fills up)
  // reads as a broken provider rather than a rejected one. `templates`,
  // `comments` and `versionHistory` ARE declared, but typed narrowly as
  // `TemplatesOptions`, `CommentsOptions` and `VersionHistoryOptions` — a
  // JavaScript consumer can still hand over a full provider, so its storage
  // methods are named and ignored the same way, while any events they carry
  // reach `eventsOf` / `commentEventsOf` / `versionHistoryEventsOf` below
  // regardless of this check.
  const consumerTemplates = (config as { templates?: Record<string, unknown> })
    .templates;
  // Presence, not `typeof === "function"` — see the matching comment on
  // `ignoredCommentMethods` below: a stated-but-ignored decision like
  // `save: false` is as much a signal as a stray function override.
  const ignoredTemplateMethods = ["load", "create", "save"].filter(
    (key) => typeof consumerTemplates?.[key] !== "undefined",
  );
  if (ignoredTemplateMethods.length > 0) {
    logger.warn(
      `initCloud ignores ${joinWithAnd(
        ignoredTemplateMethods.map((key) => `templates.${key}`),
      )} — the template id is the join key for collaboration, ` +
        "version history, comments, AI rewrite, scoring and the server-side " +
        "export, so an id Cloud never issued would degrade all six. Your " +
        "event handlers were kept. Use init() to bring your own storage.",
    );
  }
  const consumerVersionHistory = (
    config as { versionHistory?: Record<string, unknown> }
  ).versionHistory;
  // Presence, not `typeof === "function"`: a stated-but-ignored decision like
  // `restore: false` is as much a signal as a stray function override, and
  // both must be named here or the consumer never learns it was dropped.
  const ignoredVersionHistoryMethods = [
    "list",
    "get",
    "create",
    "restore",
  ].filter((key) => typeof consumerVersionHistory?.[key] !== "undefined");
  if (ignoredVersionHistoryMethods.length > 0) {
    logger.warn(
      `initCloud ignores ${joinWithAnd(
        ignoredVersionHistoryMethods.map((key) => `versionHistory.${key}`),
      )} — a version is keyed to a template id Cloud issued, so Cloud owns ` +
        "its history. Your event handlers were kept. Use init() to bring " +
        "your own storage.",
    );
  }
  const consumerComments = (config as { comments?: Record<string, unknown> })
    .comments;
  // Presence, not `typeof === "function"`: a stated-but-ignored decision like
  // `create: false` is as much a signal as a stray function override, and both
  // must be named here or the consumer never learns it was dropped.
  const ignoredCommentMethods = [
    "list",
    "create",
    "update",
    "delete",
    "setResolved",
    "subscribe",
  ].filter((key) => typeof consumerComments?.[key] !== "undefined");
  if (ignoredCommentMethods.length > 0) {
    logger.warn(
      `initCloud ignores ${joinWithAnd(
        ignoredCommentMethods.map((key) => `comments.${key}`),
      )} — a comment is keyed to a template id Cloud issued, and its ` +
        "author is signed by the auth token, so Cloud owns the conversation. " +
        "Your event handlers were kept. Use init() to bring your own storage.",
    );
  }
  // Rejected for a different reason than the three above: not the join key, but
  // because Cloud renders on its own for test email, scheduled sends and API
  // exports (`createCloudTestEmailProvider` calls `exportHtml` directly). A
  // consumer provider would have changed `toMjml()` / `toHtml()` and nothing
  // else, so what the user previewed and exported was not what Cloud delivered —
  // and Cloud's output is a deliberate superset (countdown GIFs, composited video
  // thumbnails), so the consumer's was also worse for those blocks.
  if ((config as { render?: unknown }).render) {
    logger.warn(
      "initCloud does not accept a `render` provider — Cloud renders " +
        "server-side for test email, sends and exports, so a supplied renderer " +
        "would change only what you preview and export, never what Cloud " +
        "delivers. The supplied provider is ignored. For your own MJML, call " +
        "renderToMjml(editor.getContent()) from @templatical/renderer.",
    );
  }

  // --- Providers ------------------------------------------------------------

  function connectRealtime(template: Template): void {
    const websocketConfig = planConfigInstance.config.value?.websocket;
    if (!websocketRef || !websocketConfig) return;
    websocketRef.connect(template.id, resolveWebSocketConfig(websocketConfig));
  }

  const baseTemplates = createCloudTemplatesProvider(authManager);
  const baseCreate = baseTemplates.create;
  const baseSave = baseTemplates.save;

  /**
   * Cloud's templates adapter plus the choreography the template id anchors:
   * the websocket joins the template's presence channel. The consumer's
   * `onSaved` / `onCreated` / `onLoaded` ride along via `eventsOf` — core calls
   * them once the editor has settled, so the adapter itself never invokes them.
   *
   * That choreography belongs in the adapter rather than in an editor-side
   * lifecycle composable, because it *is* adapter business — Cloud is what keys
   * realtime off the id it issued. `useCloudLifecycle` existed only to hold it.
   *
   * `save` pre-renders custom blocks, which is why it is wrapped too.
   */
  const templates: TemplatesProvider = {
    ...eventsOf(config.templates),
    load: async (id: string) => {
      const template = await baseTemplates.load(id);
      connectRealtime(template);
      return template;
    },
    create:
      typeof baseCreate === "function"
        ? async (input: { name?: string; content: TemplateContent }) => {
            const template = await baseCreate(input);
            connectRealtime(template);
            return template;
          }
        : false,
    save:
      typeof baseSave === "function"
        ? async (id: string, patch: TemplatePatch) => {
            if (coreRef && editorRef) {
              await preRenderCustomBlocks(
                editorRef.content.value,
                coreRef.registry,
              );
            }
            return baseSave(id, patch);
          }
        : false,
  };

  // Always Cloud's — see the rejected-keys block above. Cloud renders
  // independently for delivery, so a second renderer could only disagree with it.
  const render: RenderProvider = createCloudRenderProvider({
    authManager,
    getTemplateId,
    // Plain `editor.save()`: the templates adapter below already pre-renders
    // custom blocks on every save, which is exactly what the render endpoint
    // needs, since it exports from the stored copy rather than from
    // `payload.content`.
    save: () => requireEditor().save(),
  });

  // The consumer's `onCreated` / `onRestored` ride along via
  // `versionHistoryEventsOf` — core calls them once the editor has settled, so
  // the adapter itself never invokes them. `versionHistory` never accepts a
  // full provider (see the rejected-keys block above), so this always merges
  // onto Cloud's own adapter, never onto a consumer's.
  const versionHistory: VersionHistoryProvider = {
    ...versionHistoryEventsOf(config.versionHistory),
    ...createCloudVersionHistoryProvider(authManager),
  };

  // Realtime is the adapter's own business: `subscribe` binds the presence channel
  // above, so `useCommentListener` in `@templatical/core` never learns that Pusher
  // exists and a BYO provider with an SSE stream slots into the same seam. The
  // consumer's `onCreated` / `onUpdated` / `onDeleted` / `onResolved` /
  // `onUnresolved` ride along via `commentEventsOf` — core calls them once the
  // editor has settled, so the adapter itself never invokes them.
  const comments: CommentsProvider = {
    ...commentEventsOf(config.comments),
    ...createCloudCommentsProvider({
      authManager,
      channel: commentChannel,
      getSocketId: () => websocketRef?.getSocketId() ?? null,
    }),
  };

  // From the JWT, not from config. Cloud signs comment writes against this same
  // claim, so a consumer-supplied identity could only disagree with it — and a
  // token without the claim leaves comments unavailable rather than anonymous.
  const cloudUser: EditorUser | undefined = authManager.userConfig
    ? { id: authManager.userConfig.id, name: authManager.userConfig.name }
    : undefined;

  // A consumer may pass their own store instead of a boolean, in which case it
  // replaces Cloud's outright — discriminated on `list`, the one required
  // method every full provider carries, never on `typeof === "object"`: an
  // events-only `SavedBlocksOptions` (`{ onCreated }`) is an object too, and
  // reading it as the provider would leave `list` undefined and crash the
  // library on first browse. That path is deliberately NOT plan-gated:
  // `saved_modules` licenses Cloud's *storage*, and someone else's backend
  // isn't Cloud's to sell — `isSavedBlocksAvailable` below keys off this same
  // discriminated value for that reason.
  const consumerSavedBlocks =
    typeof (config.savedBlocks as SavedBlocksProvider | undefined)?.list ===
    "function"
      ? (config.savedBlocks as SavedBlocksProvider)
      : null;
  // A malformed provider — e.g. `create` / `update` / `delete` with no
  // working `list` — fails the discriminator above and falls through to
  // Cloud's own store, so those methods are silently unused rather than
  // replacing anything. Named here the same way `templates` / `comments` /
  // `versionHistory` name their own ignored methods, so the drop isn't a
  // console-free mystery.
  if (
    consumerSavedBlocks === null &&
    typeof config.savedBlocks === "object" &&
    config.savedBlocks !== null
  ) {
    const suppliedSavedBlocks = config.savedBlocks as Record<string, unknown>;
    const ignoredSavedBlocksMethods = [
      "list",
      "create",
      "update",
      "delete",
    ].filter((key) => typeof suppliedSavedBlocks[key] !== "undefined");
    if (ignoredSavedBlocksMethods.length > 0) {
      logger.warn(
        `initCloud ignores ${joinWithAnd(
          ignoredSavedBlocksMethods.map((key) => `savedBlocks.${key}`),
        )} — a provider needs a working list to replace Cloud's store, and ` +
          "this value has none, so it configures Cloud's own store instead. " +
          "Your event handlers were kept. Use init() to bring your own storage.",
      );
    }
  }
  // The consumer's `onCreated` / `onUpdated` / `onDeleted` ride along via
  // `savedBlocksEventsOf` when Cloud's own adapter is used — core calls them
  // once the editor has settled, so the adapter itself never invokes them. A
  // full consumer provider carries its own events already and is used as-is,
  // so this merge only ever runs on Cloud's side of the `??`.
  const savedBlocks: SavedBlocksProvider | undefined =
    config.savedBlocks === false
      ? undefined
      : (consumerSavedBlocks ?? {
          ...savedBlocksEventsOf(config.savedBlocks),
          ...createCloudSavedBlocksProvider(authManager),
        });

  // Cloud's test-email *config* — plan enablement plus the signed allowlist, both
  // carried by the JWT `authManager.initialize()` already resolved above. Hence
  // the constant `isAuthReady`: there is no window where it is false.
  const testEmailConfig = useTestEmail({
    authManager,
    isAuthReady: ref(true),
  });

  // Cloud's own send path renders through the export endpoint directly: the
  // adapter derives HTML from the *saved* template and applies
  // `onBeforeTestEmail` to it, which is a narrower job than the render contract.
  const exporter = useExport({ authManager });

  // Discriminated on `send`, the one required method every full provider
  // carries — never on raw truthiness, which an events-only `TestEmailOptions`
  // (`{ onSent }`) also satisfies and would leave `send` undefined, crashing
  // the dialog on send. `isTestEmailAvailable` below keys off this same
  // discriminated value so an events-only value stays plan-gated rather than
  // reading as "consumer's own sender".
  const consumerTestEmail =
    typeof (config.testEmail as TestEmailProvider | undefined)?.send ===
    "function"
      ? (config.testEmail as TestEmailProvider)
      : null;
  // `send` reaching here means it failed the discriminator above — e.g.
  // `send: null` — so it is named the same way a malformed `savedBlocks`
  // value's storage methods are. `includeMjml` / `allowedRecipients` are
  // named for a different reason: they are not part of this key's options
  // arm (see `cloudConfig.ts`), but TypeScript does not actually refuse
  // them — both are valid members of the sibling `TestEmailProvider` arm, so
  // the union's excess-property check passes them through regardless of
  // which arm the caller intended. All three log a warning naming them
  // rather than dropping with no console trace.
  if (
    consumerTestEmail === null &&
    typeof config.testEmail === "object" &&
    config.testEmail !== null
  ) {
    const suppliedTestEmail = config.testEmail as Record<string, unknown>;
    const ignoredTestEmailMembers = [
      "send",
      "includeMjml",
      "allowedRecipients",
    ].filter((key) => typeof suppliedTestEmail[key] !== "undefined");
    if (ignoredTestEmailMembers.length > 0) {
      logger.warn(
        `initCloud ignores ${joinWithAnd(
          ignoredTestEmailMembers.map((key) => `testEmail.${key}`),
        )} — a provider needs a working send to replace Cloud's sender ` +
          "outright, and Cloud renders server-side with the signed " +
          "allowlist from your project's JWT either way, so none of these " +
          "apply here. Your event handlers were kept.",
      );
    }
  }
  const testEmail: TestEmailProvider =
    consumerTestEmail ??
    // `Object.assign`, not a spread: `createCloudTestEmailProvider`'s
    // `allowedRecipients` is a live getter (see `testEmailEventsOf`'s doc
    // comment for why a spread would freeze it). The cloud provider is the
    // assignment *target* here, so its getter is never read — only the keys
    // `testEmailEventsOf` returns are ever written onto it.
    //
    // Asymmetric with `savedBlocks` / `versionHistory` on purpose, not by
    // drift: those two spread Cloud's provider LAST, so even a whitelist that
    // let something unexpected through could never displace a Cloud method —
    // two lines of defence. Here `testEmailEventsOf`'s return type is the
    // only barrier, because Cloud is the assignment target rather than a
    // second spread source. Copying the sibling shape (`{ ...events,
    // ...createCloudTestEmailProvider(...) }`) would reintroduce the exact
    // getter-freezing bug this construction exists to avoid.
    Object.assign(
      createCloudTestEmailProvider({
        authManager,
        getTemplateId,
        save: () => requireEditor().save(),
        exportHtml: (templateId: string) =>
          exporter.exportHtml(templateId, resolveExportFonts(config.fonts)),
        allowedEmails: testEmailConfig.allowedEmails,
        getSignature: testEmailConfig.getSignature,
        onBeforeTestEmail: config.onBeforeTestEmail,
      }),
      testEmailEventsOf(config.testEmail),
    );

  // --- Setup-time wiring ----------------------------------------------------

  const aiConfig = useAiConfig(config.ai);
  const scoringInstance = useTemplateScoring({ authManager, getTemplateId });

  const featureFlags = useCloudFeatureFlags({
    planConfigInstance,
    aiConfig,
    getTemplateId,
  });

  const isCollaborationEnabled = computed(
    () =>
      !!config.collaboration?.enabled &&
      planConfigInstance.hasFeature("collaboration"),
  );

  function attach(context: CloudAttachContext): CloudAttachment {
    const editor = context.editor;
    editorRef = editor;

    provide(CLOUD_TRANSLATIONS_KEY, cloudTranslations);
    provide(AUTH_MANAGER_KEY, authManager);
    provide(AI_CONFIG_KEY, aiConfig);
    provide(SCORING_KEY, scoringInstance);

    const websocket = useWebSocket({ authManager, onError: config.onError });
    websocketRef = websocket;

    // Feeds the comments adapter's `subscribe`, which was handed to `init()` before
    // this socket existed.
    watch(
      websocket.channel,
      (channel) => {
        commentChannel.value = channel;
      },
      { immediate: true },
    );

    if (config.mcp?.enabled) {
      useMcpListener({
        editor,
        channel: websocket.channel,
        onOperation: config.mcp.onOperation,
      });
    }

    // Order matters: the broadcast wrapper replaces the editor's mutators so they
    // publish to peers, and `useEditorCore`'s history interceptor then wraps them
    // again to push history entries. Reversing it would push history for remote
    // operations and drift the two peers apart.
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
      }) as CloudCollaborationInstance;

      watch(
        () => collaboration!.lockedBlocks.value,
        (next) => {
          lockedBlocks.value = next;
        },
        { immediate: true },
      );

      useCollaborationBroadcast(editor, collaboration);
    }

    const panelState = useCloudPanelState();

    const mediaLib = useCloudMediaLibrary({
      onRequestMedia: config.onRequestMedia,
      mediaLibraryOpen: panelState.mediaLibraryOpen,
      mediaLibraryAccept: panelState.mediaLibraryAccept,
      authManager,
      getMediaConfig: () => planConfigInstance.config.value?.media ?? null,
      onError: config.onError,
    });
    mediaLibRef = mediaLib;

    return {
      websocket,
      panelState,
      mediaLib,
      // Handed to `MediaLibraryModal` as props by `CloudPanels`. A bare-string
      // injection would resolve to `undefined` silently; see
      // `CloudMediaBrowserContext`.
      mediaBrowser: {
        authManager,
        projectId: authManager.projectId,
        planConfig: planConfigInstance,
      },
      featureFlags,
      collaboration,
      isCollaborationEnabled,
    };
  }

  function ready(context: CloudReadyContext): CloudReady {
    const { core, capabilities } = context;
    coreRef = core;

    saveGate = useCloudSaveGate({
      issues: core.templateLint ? core.templateLint.issues : ref([]),
      planConfig: planConfigInstance.config,
    });

    collabWarning = useCollabUndoWarning({
      isCollaborationEnabled,
      getCollaboratorCount: () =>
        collaboration?.collaborators.value.length ?? 0,
      canUndo: core.history.canUndo,
    });

    // Mutated in place rather than re-provided: `useEditorCore` already provided
    // this exact object, so components injecting it see Cloud's entries on their
    // first render. Same pattern `versionHistory` uses in `Editor.vue`.
    //
    // `capabilities.comments` is *not* set here any more: comments became a shared
    // provider-backed feature, so `Editor.vue` builds the capability from
    // `useCommentsFeature` exactly as it does for saved blocks and test email, and
    // Cloud contributes only the two predicates below.
    capabilities.plan = planConfigInstance;
    capabilities.ai = aiConfig;

    // Registered unconditionally. `custom_blocks` and `theme_customization` used
    // to gate these — entitlements on editor capability the free editor grants,
    // and the only two things `applyPlanGates` would ever have had to do.
    if (config.customBlocks?.length) {
      core.registerCustomBlocks(config.customBlocks);
    }
    if (config.theme) {
      core.themeOverrides.value = config.theme;
    }

    return {
      saveGate,
      collabWarning,
      sessionError,
      retry: async () => {
        try {
          await authManager.initialize();
          sessionError.value = null;
        } catch (error) {
          sessionError.value =
            error instanceof Error ? error : new Error("Authentication failed");
        }
      },
    };
  }

  const runtime: CloudRuntime = {
    lockedBlocks,
    onRequestMedia: (context) =>
      mediaLibRef
        ? mediaLibRef.handleRequestMedia(context)
        : Promise.resolve(null),
    isSavedBlocksAvailable: consumerSavedBlocks
      ? () => true
      : () =>
          config.savedBlocks !== false &&
          planConfigInstance.hasFeature("saved_modules"),
    isTestEmailAvailable: consumerTestEmail
      ? // Their sender, their rules — the `test_email` plan feature licenses
        // Cloud's sending, and "the template must be saved" is a constraint of
        // Cloud's server-side render, not of an arbitrary backend.
        () => true
      : // All three matter and none implies another: the plan may grant the
        // feature while the project's token omits a recipient config, and Cloud
        // renders from the *saved* template so there must be one.
        () =>
          testEmailConfig.isEnabled.value &&
          featureFlags.canSendTestEmail.value &&
          featureFlags.hasTemplateSaved.value,
    // Three conditions, none implying another: the consumer may switch the feature
    // off, the plan meters comment storage and its realtime fan-out, and Cloud
    // anchors a comment to the *saved* template. (Whether a `user` exists is the
    // shared feature's own gate, not Cloud's.)
    isCommentsAvailable: () =>
      config.comments !== false &&
      planConfigInstance.hasFeature("commenting") &&
      featureFlags.hasTemplateSaved.value,
    // A comment is anchored server-side, so a block that exists only on the canvas
    // has nothing stored to show. This is the last thing the deleted cloud editor
    // core carried (`savedBlockIds`), and it was always a comments concern rather
    // than an editor one.
    isBlockSaved: (blockId: string) =>
      collectSavedBlockIds(editorRef?.state.template ?? null).has(blockId),
    getSaveGate: () => saveGate,
    isRemoteOperation: () =>
      collaboration?._isProcessingRemoteOperation() ?? false,
    onBeforeUndo: () => collabWarning?.showCollabUndoWarning(),
    attach,
    ready,
    destroy() {
      websocketRef?.disconnect();
      config.onUnmount?.();
    },
  };

  return {
    runtime,
    providers: {
      templates,
      render,
      versionHistory,
      ...(savedBlocks ? { savedBlocks } : {}),
      testEmail,
      comments,
    },
    user: cloudUser,
  };
}
