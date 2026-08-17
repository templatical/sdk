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
  CommentsProvider,
  EditorUser,
  RenderProvider,
  SavedBlocksProvider,
  Template,
  TemplateContent,
  TemplatePatch,
  TemplatesProvider,
  TestEmailProvider,
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
  // None is declared on `TemplaticalCloudEditorConfig`, so these only fire for
  // JavaScript consumers — warned rather than silently dropped, because the
  // symptom (a store that stays empty while Cloud's fills up) reads as a broken
  // provider rather than a rejected one.
  if ((config as { templates?: unknown }).templates) {
    logger.warn(
      "initCloud does not accept a `templates` provider — the template id is " +
        "the join key for collaboration, version history, comments, AI rewrite, " +
        "scoring and the server-side export, so an id Cloud never issued would " +
        "degrade all six. The supplied provider is ignored. Use init() to bring " +
        "your own.",
    );
  }
  if ((config as { versionHistory?: unknown }).versionHistory) {
    logger.warn(
      "initCloud does not accept a `versionHistory` provider — a version is " +
        "keyed to a template id Cloud issued, so Cloud owns its history. The " +
        "supplied provider is ignored. Use init() to bring your own.",
    );
  }
  if ((config as { comments?: unknown }).comments) {
    logger.warn(
      "initCloud does not accept a `comments` provider — a comment is keyed to " +
        "a template id Cloud issued, and its author is signed by the auth token, " +
        "so Cloud owns the conversation. The supplied provider is ignored. Use " +
        "init() to bring your own.",
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
   * Cloud's templates adapter plus the choreography the template id anchors: the
   * websocket joins the template's presence channel, and the consumer's
   * `onCreate` / `onLoad` fire.
   *
   * That choreography belongs in the adapter rather than in an editor-side
   * lifecycle composable, because it *is* adapter business — Cloud is what keys
   * realtime off the id it issued. `useCloudLifecycle` existed only to hold it.
   *
   * `save` pre-renders custom blocks, which is why it is wrapped too.
   */
  const templates: TemplatesProvider = {
    load: async (id: string) => {
      const template = await baseTemplates.load(id);
      connectRealtime(template);
      config.onLoad?.(template);
      return template;
    },
    create:
      typeof baseCreate === "function"
        ? async (input: { name?: string; content: TemplateContent }) => {
            const template = await baseCreate(input);
            connectRealtime(template);
            config.onCreate?.(template);
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

  // Same key and same type as `init({ render })`, so upgrading an OSS integration
  // is a deletion. A consumer-supplied provider replaces Cloud's and is
  // deliberately not entitlement-gated; `??` short-circuits, so Cloud's adapter
  // isn't constructed at all in that case.
  const render: RenderProvider =
    config.render ??
    createCloudRenderProvider({
      authManager,
      getTemplateId,
      // Plain `editor.save()`: the templates adapter below already pre-renders
      // custom blocks on every save, which is exactly what the render endpoint
      // needs, since it exports from the stored copy rather than from
      // `payload.content`.
      save: () => requireEditor().save(),
    });

  const versionHistory = createCloudVersionHistoryProvider(authManager);

  // Realtime is the adapter's own business: `subscribe` binds the presence channel
  // above, so `useCommentListener` in `@templatical/core` never learns that Pusher
  // exists and a BYO provider with an SSE stream slots into the same seam.
  const comments = createCloudCommentsProvider({
    authManager,
    channel: commentChannel,
    getSocketId: () => websocketRef?.getSocketId() ?? null,
  });

  // From the JWT, not from config. Cloud signs comment writes against this same
  // claim, so a consumer-supplied identity could only disagree with it — and a
  // token without the claim leaves comments unavailable rather than anonymous.
  const cloudUser: EditorUser | undefined = authManager.userConfig
    ? { id: authManager.userConfig.id, name: authManager.userConfig.name }
    : undefined;

  // A consumer may pass their own store instead of a boolean, in which case it
  // replaces Cloud's. That path is deliberately NOT plan-gated: `saved_modules`
  // licenses Cloud's *storage*, and someone else's backend isn't Cloud's to sell.
  const consumerSavedBlocks =
    typeof config.savedBlocks === "object" && config.savedBlocks !== null
      ? config.savedBlocks
      : null;
  const savedBlocks: SavedBlocksProvider | undefined =
    config.savedBlocks === false
      ? undefined
      : (consumerSavedBlocks ?? createCloudSavedBlocksProvider(authManager));

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

  const consumerTestEmail = config.testEmail ?? null;
  const testEmail: TestEmailProvider =
    consumerTestEmail ??
    createCloudTestEmailProvider({
      authManager,
      getTemplateId,
      save: () => requireEditor().save(),
      exportHtml: (templateId: string) =>
        exporter.exportHtml(templateId, resolveExportFonts(config.fonts)),
      allowedEmails: testEmailConfig.allowedEmails,
      getSignature: testEmailConfig.getSignature,
      onBeforeTestEmail: config.onBeforeTestEmail,
    });

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
      config.commenting !== false &&
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
