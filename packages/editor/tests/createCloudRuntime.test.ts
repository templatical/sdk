// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineComponent, h, reactive, ref, computed } from "vue";
import { mount } from "@vue/test-utils";

/**
 * `bootstrapCloud` is an async bootstrap plus adapter construction, and
 * deliberately nothing more: no editor of its own, no editor *component* of its
 * own and no header of its own — those are `Editor.vue` and `EditorHeader.vue`,
 * shared with `init()`.
 *
 * What is tested here is the seam: which providers get built, which consumer
 * keys are refused, and the two hooks that must run at a specific point inside
 * the shared editor's `setup()`.
 */

const mockAuthManager = {
  initialize: vi.fn().mockResolvedValue(undefined),
  projectId: "proj-42",
  // The `user` claim Cloud signs comment writes against, and derives
  // `init({ user })` from. Nulled in one test to cover a token without it.
  userConfig: { id: "u-1", name: "Ada", signature: "sig-1" } as {
    id: string;
    name: string;
    signature: string;
  } | null,
};

vi.mock("@templatical/core/cloud", () => {
  return {
    AuthManager: vi.fn(function (this: any, config: any) {
      Object.assign(this, mockAuthManager);
      this.__config = config;
    }),
    // Mirrors the real classifier rather than stubbing a constant: the whole
    // point of the overlay gating is *which* errors pass it.
    isFatalAuthError: (error: unknown) => {
      const status = (error as { statusCode?: number })?.statusCode;
      return status !== undefined && status >= 400 && status < 500;
    },
    performHealthCheck: vi.fn().mockResolvedValue({
      api: { ok: true },
      auth: { ok: true },
      websocket: { ok: true },
    }),
    useAiConfig: vi.fn(() => ({
      enabled: computed(() => false),
      hasAnyMenuFeature: computed(() => false),
    })),
    useCollaboration: vi.fn(() => ({
      lockedBlocks: ref(new Map()),
      collaborators: ref([]),
      _broadcastOperation: vi.fn(),
      _isProcessingRemoteOperation: vi.fn(() => false),
    })),
    useCollaborationBroadcast: vi.fn(),
    createCloudCommentsProvider: vi.fn(() => ({
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setResolved: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    })),
    useExport: vi.fn(() => ({
      exportHtml: vi.fn(),
      getMjmlSource: vi.fn(),
    })),
    resolveExportFonts: vi.fn(() => ({
      customFonts: [],
      defaultFallback: "Arial, sans-serif",
    })),
    resolveWebSocketConfig: vi.fn((c: unknown) => c),
    useMcpListener: vi.fn(),
    usePlanConfig: vi.fn(() => ({
      config: ref({ websocket: { host: "h", port: 1, app_key: "k" } }),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => true),
    })),
    createCloudSavedBlocksProvider: vi.fn(() => ({
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
    createCloudTemplatesProvider: vi.fn(() => ({
      load: vi.fn().mockResolvedValue({ id: "tmpl-1", content: {} }),
      create: vi.fn().mockResolvedValue({ id: "tmpl-2", content: {} }),
      save: vi.fn().mockResolvedValue({ id: "tmpl-1", content: {} }),
    })),
    createCloudVersionHistoryProvider: vi.fn(() => ({
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
    })),
    createCloudRenderProvider: vi.fn(() => ({
      toMjml: vi.fn().mockResolvedValue("<mjml>cloud</mjml>"),
      toHtml: vi.fn().mockResolvedValue("<html>cloud</html>"),
    })),
    createCloudTestEmailProvider: vi.fn(() => ({
      send: vi.fn().mockResolvedValue(undefined),
      get allowedRecipients() {
        return ["qa@templatical.test"];
      },
    })),
    useTemplateScoring: vi.fn(() => ({ fixError: ref(null) })),
    useTestEmail: vi.fn(() => ({
      isEnabled: computed(() => true),
      allowedEmails: computed(() => ["qa@templatical.test"]),
      getSignature: () => "sig",
    })),
    useWebSocket: vi.fn(() => ({
      channel: ref(null),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: ref(false),
      getSocketId: vi.fn(() => null),
    })),
  };
});

vi.mock("../src/cloud/composables/useCloudPanelState", () => ({
  useCloudPanelState: vi.fn(() => ({
    commentsOpen: ref(false),
    mediaLibraryOpen: ref(false),
    mediaLibraryAccept: ref(null),
    rightPanelOpen: computed(() => false),
  })),
}));

vi.mock("../src/cloud/composables/useCollabUndoWarning", () => ({
  useCollabUndoWarning: vi.fn(() => ({
    collabUndoWarningVisible: ref(false),
    showCollabUndoWarning: vi.fn(),
  })),
}));

vi.mock("../src/cloud/composables/useCloudMediaLibrary", () => ({
  useCloudMediaLibrary: vi.fn(() => ({
    handleRequestMedia: vi.fn().mockResolvedValue({ url: "https://x/y.png" }),
    handleMediaSelect: vi.fn(),
    handleMediaLibraryClose: vi.fn(),
  })),
}));

vi.mock("../src/utils/preRenderCustomBlocks", () => ({
  preRenderCustomBlocks: vi.fn().mockResolvedValue(undefined),
}));

import {
  AuthManager,
  createCloudCommentsProvider,
  createCloudRenderProvider,
  createCloudSavedBlocksProvider,
  createCloudTemplatesProvider,
  createCloudVersionHistoryProvider,
  performHealthCheck,
  useCollaboration,
  useCollaborationBroadcast,
  usePlanConfig,
  useWebSocket,
} from "@templatical/core/cloud";
import type { SavedBlocksProvider } from "@templatical/types";
import { preRenderCustomBlocks } from "../src/utils/preRenderCustomBlocks";
import { bootstrapCloud } from "../src/cloud/createCloudRuntime";

const cloudTranslations = {
  header: { title: "Templatical", templatesUsed: "{used}/{max}" },
} as any;

function bootstrap(config: any = {}) {
  return bootstrapCloud({
    config: { auth: {}, ...config } as any,
    cloudTranslations,
  });
}

function fakeEditor() {
  return {
    // `reactive`, not a plain object: Cloud's availability flags are `computed`s
    // over `getTemplateId()`, and a computed over an untracked plain object caches
    // its first answer forever — a test that mutates one would assert nothing.
    state: reactive({ template: null as { id: string } | null }),
    content: ref({ blocks: [], settings: {} }),
    save: vi.fn().mockResolvedValue({ id: "tmpl-1", content: {} }),
    addBlock: vi.fn(),
    updateBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateSettings: vi.fn(),
    setContent: vi.fn(),
    selectBlock: vi.fn(),
  } as any;
}

/** Runs `attach` inside a real setup(), because it calls `provide()`. */
function attachInComponent(runtime: any, editor = fakeEditor()) {
  let attachment: any;
  const wrapper = mount(
    defineComponent({
      setup() {
        attachment = runtime.attach({ editor });
        return () => h("div");
      },
    }),
  );
  return { wrapper, attachment, editor };
}

function fakeCore() {
  return {
    templateLint: null,
    history: { canUndo: computed(() => false) },
    registry: {},
    themeOverrides: ref({}),
    registerCustomBlocks: vi.fn(),
  } as any;
}

beforeEach(() => {
  mockAuthManager.initialize.mockClear().mockResolvedValue(undefined);
  vi.mocked(performHealthCheck)
    .mockClear()
    .mockResolvedValue({
      api: { ok: true },
      auth: { ok: true },
      websocket: { ok: true },
    } as any);
  vi.mocked(useCollaboration).mockClear();
  vi.mocked(useCollaborationBroadcast).mockClear();
  vi.mocked(createCloudSavedBlocksProvider).mockClear();
  vi.mocked(createCloudCommentsProvider).mockClear();
  vi.mocked(createCloudRenderProvider).mockClear();
  vi.mocked(createCloudTemplatesProvider).mockClear();
  vi.mocked(createCloudVersionHistoryProvider).mockClear();
  vi.mocked(preRenderCustomBlocks).mockClear();
  vi.mocked(useWebSocket).mockClear();
});

describe("bootstrapCloud — the bootstrap runs before the mount", () => {
  it("completes auth, the health check and the plan fetch before returning", async () => {
    const { runtime } = await bootstrap();

    expect(mockAuthManager.initialize).toHaveBeenCalledTimes(1);
    expect(performHealthCheck).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(usePlanConfig).mock.results.at(-1)!.value.fetchConfig,
    ).toHaveBeenCalledTimes(1);
    // Nothing has mounted yet, so nothing has attached.
    expect(runtime.getSaveGate()).toBe(null);
  });

  it("rejects when the API health check fails, rather than mounting a dead editor", async () => {
    vi.mocked(performHealthCheck).mockResolvedValueOnce({
      api: { ok: false },
      auth: { ok: true },
      websocket: { ok: true },
    } as any);

    await expect(bootstrap()).rejects.toThrow(/API is not reachable/);
  });

  it("rejects when authentication fails, carrying the reason", async () => {
    vi.mocked(performHealthCheck).mockResolvedValueOnce({
      api: { ok: true },
      auth: { ok: false, error: "Invalid token" },
      websocket: { ok: true },
    } as any);

    await expect(bootstrap()).rejects.toThrow(/Invalid token/);
  });

  it("tolerates a websocket health failure and continues", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(performHealthCheck).mockResolvedValueOnce({
      api: { ok: true },
      auth: { ok: true },
      websocket: { ok: false, error: "no route" },
    } as any);

    const { providers } = await bootstrap();

    expect(providers.templates).toBeTypeOf("object");
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("WebSocket health check"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });
});

describe("bootstrapCloud — providers handed to init()", () => {
  it("builds Cloud's templates, render and version-history adapters", async () => {
    const { providers } = await bootstrap();

    expect(createCloudTemplatesProvider).toHaveBeenCalledTimes(1);
    expect(createCloudRenderProvider).toHaveBeenCalledTimes(1);
    expect(createCloudVersionHistoryProvider).toHaveBeenCalledTimes(1);
    expect(providers.versionHistory).toBe(
      vi.mocked(createCloudVersionHistoryProvider).mock.results[0].value,
    );
  });

  it("connects the websocket to the template the adapter just loaded", async () => {
    const { runtime, providers } = await bootstrap();
    const { attachment } = attachInComponent(runtime);

    await providers.templates.load("tmpl-1");

    expect(attachment.websocket.connect).toHaveBeenCalledWith(
      "tmpl-1",
      expect.anything(),
    );
  });

  it("fires onCreate / onLoad from the adapter, not from a lifecycle composable", async () => {
    const onCreate = vi.fn();
    const onLoad = vi.fn();
    const { runtime, providers } = await bootstrap({ onCreate, onLoad });
    attachInComponent(runtime);

    await providers.templates.load("tmpl-1");
    await (providers.templates.create as any)({ content: {} });

    expect(onLoad).toHaveBeenCalledWith({ id: "tmpl-1", content: {} });
    expect(onCreate).toHaveBeenCalledWith({ id: "tmpl-2", content: {} });
  });

  it("pre-renders custom blocks before persisting, since Cloud exports from storage", async () => {
    const { runtime, providers } = await bootstrap();
    const { attachment } = attachInComponent(runtime);
    expect(attachment).toBeTypeOf("object");
    runtime.ready({ core: fakeCore(), capabilities: {} });

    await (providers.templates.save as any)("tmpl-1", { content: {} });

    expect(preRenderCustomBlocks).toHaveBeenCalledTimes(1);
  });

  it("ignores a consumer-supplied render provider, and says so", async () => {
    // Rejected for a different reason than the id-keyed three: Cloud renders
    // server-side for test email, sends and exports, so a consumer's renderer
    // would have changed only what the editor previews and exports — never what
    // Cloud delivers.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const render = { compileMjml: vi.fn(), toMjml: vi.fn(), toHtml: vi.fn() };

    const { providers } = await bootstrap({ render });

    expect(createCloudRenderProvider).toHaveBeenCalledTimes(1);
    expect(providers.render).not.toBe(render);
    expect(render.toMjml).not.toHaveBeenCalled();
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("does not accept a `render` provider"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });
});

/**
 * `config.savedBlocks` accepts a boolean OR a `SavedBlocksProvider`, so the same
 * key means the same thing in `init()` and `initCloud()` — an OSS integration
 * upgrades by deleting the key (to adopt Cloud's store) or leaving it untouched
 * (to keep its own), never by rewriting it.
 */
describe("bootstrapCloud — savedBlocks provider selection", () => {
  function makeProvider(): SavedBlocksProvider {
    return {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  }

  function withoutPlanFeature() {
    vi.mocked(usePlanConfig).mockReturnValueOnce({
      config: ref(null),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => false),
    } as any);
  }

  it("builds Cloud's adapter when the key is omitted", async () => {
    const { providers, runtime } = await bootstrap();
    expect(createCloudSavedBlocksProvider).toHaveBeenCalledTimes(1);
    expect(providers.savedBlocks).toBeTypeOf("object");
    expect(runtime.isSavedBlocksAvailable()).toBe(true);
  });

  it("omits the provider entirely when savedBlocks is false", async () => {
    const { providers } = await bootstrap({ savedBlocks: false });
    expect(providers.savedBlocks).toBeUndefined();
    expect(createCloudSavedBlocksProvider).not.toHaveBeenCalled();
  });

  it("is unavailable when the plan withholds saved_modules", async () => {
    withoutPlanFeature();
    const { runtime } = await bootstrap();
    expect(runtime.isSavedBlocksAvailable()).toBe(false);
  });

  it("uses a consumer's store without constructing Cloud's, and never plan-gates it", async () => {
    withoutPlanFeature();
    const supplied = makeProvider();
    const { providers, runtime } = await bootstrap({ savedBlocks: supplied });

    expect(createCloudSavedBlocksProvider).not.toHaveBeenCalled();
    expect(providers.savedBlocks).toBe(supplied);
    // `saved_modules` licenses Cloud's storage; someone else's backend isn't
    // Cloud's to sell.
    expect(runtime.isSavedBlocksAvailable()).toBe(true);
  });
});

describe("bootstrapCloud — the three keys initCloud refuses", () => {
  it("ignores a consumer-supplied templates key, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supplied = { load: vi.fn(), create: false, save: false };

    const { providers } = await bootstrap({ templates: supplied });

    expect(supplied.load).not.toHaveBeenCalled();
    expect(providers.templates).not.toBe(supplied);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("does not accept a `templates` provider"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a consumer-supplied versionHistory key, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supplied = {
      list: vi.fn(),
      get: vi.fn(),
      create: false,
      restore: false,
    };

    const { providers } = await bootstrap({ versionHistory: supplied });

    expect(supplied.list).not.toHaveBeenCalled();
    expect(providers.versionHistory).not.toBe(supplied);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("does not accept a `versionHistory` provider"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a consumer-supplied comments key, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supplied = {
      list: vi.fn(),
      create: false,
      update: false,
      delete: false,
      setResolved: false,
    };

    const { providers } = await bootstrap({ comments: supplied });

    expect(supplied.list).not.toHaveBeenCalled();
    expect(providers.comments).not.toBe(supplied);
    expect(providers.comments).toBe(
      vi.mocked(createCloudCommentsProvider).mock.results.at(-1)!.value,
    );
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("does not accept a `comments` provider"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("warns about nothing when none was supplied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await bootstrap();
    expect(
      warn.mock.calls.some((a) => a.join(" ").includes("does not accept")),
    ).toBe(false);
    warn.mockRestore();
  });
});

describe("bootstrapCloud — only a fatal auth failure raises the overlay", () => {
  /**
   * The overlay blanks a mounted editor over a template that is very likely
   * unsaved, so it is reserved for a session that is genuinely over. A 4xx means
   * the endpoint refused the credentials and every later request fails the same
   * way; a 5xx or a dropped connection resolves on its own.
   *
   * The consumer's `onError` fires either way — that is the channel for "this
   * happened", while the overlay is the channel for "stop editing".
   */
  async function refreshFails(status: number | undefined, onError = vi.fn()) {
    const { runtime } = await bootstrap({ onError });
    attachInComponent(runtime);
    const ready = runtime.ready({ core: fakeCore(), capabilities: {} });

    const authInstance = vi.mocked(AuthManager).mock.instances.at(-1) as any;
    const error = Object.assign(new Error("refresh failed"), {
      statusCode: status,
    });
    authInstance.__config.onError(error);
    return { ready, onError, error };
  }

  it("raises the overlay when the credentials are refused", async () => {
    const { ready, error } = await refreshFails(401);
    expect(ready.sessionError.value).toBe(error);
  });

  it("leaves the editor alone for a server error", async () => {
    const { ready } = await refreshFails(503);
    expect(ready.sessionError.value).toBeNull();
  });

  it("leaves the editor alone for a network failure with no status", async () => {
    const { ready } = await refreshFails(undefined);
    expect(ready.sessionError.value).toBeNull();
  });

  it("tells the consumer either way", async () => {
    const transient = vi.fn();
    await refreshFails(503, transient);
    expect(transient).toHaveBeenCalledOnce();

    const fatal = vi.fn();
    await refreshFails(401, fatal);
    expect(fatal).toHaveBeenCalledOnce();
  });
});

describe("CloudRuntime.attach — what must run inside setup()", () => {
  it("does not build collaboration when it is off", async () => {
    const { runtime } = await bootstrap();
    const { attachment } = attachInComponent(runtime);

    expect(useCollaboration).not.toHaveBeenCalled();
    expect(attachment.collaboration).toBe(null);
  });

  it("broadcasts *after* collaboration is built, so the history interceptor wraps last", async () => {
    const { runtime } = await bootstrap({ collaboration: { enabled: true } });
    attachInComponent(runtime);

    expect(useCollaboration).toHaveBeenCalledTimes(1);
    expect(useCollaborationBroadcast).toHaveBeenCalledTimes(1);
    const collabOrder = vi.mocked(useCollaboration).mock.invocationCallOrder[0];
    const broadcastOrder = vi.mocked(useCollaborationBroadcast).mock
      .invocationCallOrder[0];
    expect(collabOrder).toBeLessThan(broadcastOrder);
  });

  it("mirrors the collaborators' locked blocks into the map useEditor was given", async () => {
    const locked = new Map([["block-1", {}]]);
    vi.mocked(useCollaboration).mockReturnValueOnce({
      lockedBlocks: ref(locked),
      collaborators: ref([]),
      _broadcastOperation: vi.fn(),
      _isProcessingRemoteOperation: vi.fn(() => false),
    } as any);

    const { runtime } = await bootstrap({ collaboration: { enabled: true } });
    expect(runtime.lockedBlocks.value.size).toBe(0);

    attachInComponent(runtime);

    expect(runtime.lockedBlocks.value.has("block-1")).toBe(true);
  });

  it("routes media requests through Cloud's browser once attached", async () => {
    const { runtime } = await bootstrap();
    // Before attach there is no browser to open, and the honest answer is "no
    // selection" rather than a throw.
    await expect(runtime.onRequestMedia()).resolves.toBe(null);

    attachInComponent(runtime);

    await expect(runtime.onRequestMedia()).resolves.toEqual({
      url: "https://x/y.png",
    });
  });
});

/**
 * `MediaLibraryModal` takes `authManager`, `projectId` and `planConfig` as
 * **props**. Injection cannot be used for them: Vue matches keys by identity, so a
 * bare string never resolves this package's `AUTH_MANAGER_KEY = Symbol(...)`, and
 * the miss is silent — every value arrives `undefined` and the media browser opens
 * inert with nothing to trace.
 *
 * Because they are props, a dropped binding fails `vue-tsc`. These two cover what
 * a type cannot: that the attachment actually carries the values, and that
 * `CloudPanels` actually binds them.
 */
describe("CloudRuntime.attach — the media browser's props", () => {
  it("carries the auth manager, project id and plan config", async () => {
    const { runtime } = await bootstrap();
    const { attachment } = attachInComponent(runtime);

    expect(attachment.mediaBrowser.authManager).toBe(
      vi.mocked(AuthManager).mock.instances.at(-1),
    );
    expect(attachment.mediaBrowser.projectId).toBe("proj-42");
    expect(attachment.mediaBrowser.planConfig).toBe(
      vi.mocked(usePlanConfig).mock.results.at(-1)!.value,
    );
  });

  it("is bound onto MediaLibraryModal by CloudPanels", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "src/cloud/components/CloudPanels.vue"),
      "utf8",
    );
    const tag = source.match(/<MediaLibraryModal[\s\S]*?\/>/)?.[0] ?? "";

    expect(tag).toContain(':auth-manager="cloud.mediaBrowser.authManager"');
    expect(tag).toContain(':project-id="cloud.mediaBrowser.projectId"');
    expect(tag).toContain(':plan-config="cloud.mediaBrowser.planConfig"');
  });
});

describe("CloudRuntime.ready — what must run after useEditorCore", () => {
  it("builds the lint save-gate that the shared header's Save routes through", async () => {
    const { runtime } = await bootstrap();
    attachInComponent(runtime);
    expect(runtime.getSaveGate()).toBe(null);

    const ready = runtime.ready({ core: fakeCore(), capabilities: {} });

    expect(runtime.getSaveGate()).toBe(ready.saveGate);
    expect(ready.saveGate.shouldBlock.value).toBe(false);
  });

  it("mutates the capabilities object in place so first render sees Cloud's entries", async () => {
    const { runtime } = await bootstrap();
    attachInComponent(runtime);
    const capabilities: any = {};

    runtime.ready({ core: fakeCore(), capabilities });

    expect(capabilities.plan).toBeTypeOf("object");
    expect(capabilities.ai).toBeTypeOf("object");
    // `capabilities.comments` is deliberately NOT one of them any more. Comments
    // became a shared provider-backed feature, so `Editor.vue` builds that
    // capability from `useCommentsFeature` exactly as it does for saved blocks and
    // test email; Cloud contributes only the two predicates below.
    expect(capabilities.comments).toBe(undefined);
  });

  it("registers custom blocks and the theme unconditionally", async () => {
    // Neither custom blocks nor the theme is plan-gated: both are editor
    // capability the free editor grants unconditionally, so the bootstrap has no
    // config-suppression step for a plan to drive.
    vi.mocked(usePlanConfig).mockReturnValueOnce({
      config: ref(null),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => false),
    } as any);

    const definitions = [{ type: "qrcode" }] as any;
    const theme = { colors: { primary: "#000" } } as any;
    const { runtime } = await bootstrap({ customBlocks: definitions, theme });
    attachInComponent(runtime);

    const core = fakeCore();
    runtime.ready({ core, capabilities: {} });

    expect(core.registerCustomBlocks).toHaveBeenCalledWith(definitions);
    expect(core.themeOverrides.value).toEqual(theme);
  });

  it("answers isBlockSaved off the saved template — the last of savedBlockIds", async () => {
    // `savedBlockIds` was the last member of the deleted Cloud editor core, and it
    // was always a comments concern: a comment anchors server-side, so a block that
    // exists only on the canvas has nothing stored to show.
    const { runtime } = await bootstrap();
    const { editor } = attachInComponent(runtime);

    expect(runtime.isBlockSaved("b1")).toBe(false);

    editor.state.template = {
      id: "tmpl-1",
      content: { blocks: [{ id: "b1", type: "title" }] },
    };

    expect(runtime.isBlockSaved("b1")).toBe(true);
    expect(runtime.isBlockSaved("b2")).toBe(false);
  });
});

/**
 * Comments are shared now — `useCommentsFeature` over a `CommentsProvider` — so
 * what Cloud still owns is narrow: the adapter, the identity it comes from, and
 * the three conditions its own store adds on top of the contract.
 */
describe("bootstrapCloud — comments", () => {
  it("builds Cloud's adapter and hands it over as the `comments` key", async () => {
    const { providers } = await bootstrap();

    expect(createCloudCommentsProvider).toHaveBeenCalledTimes(1);
    expect(providers.comments).toBe(
      vi.mocked(createCloudCommentsProvider).mock.results.at(-1)!.value,
    );
  });

  it("derives `user` from the JWT, not from config", async () => {
    const { user } = await bootstrap({
      // Would be ignored even if the type allowed it: Cloud signs comment writes
      // against the token's own claim.
      user: { id: "spoofed", name: "Someone Else" },
    });

    expect(user).toEqual({ id: "u-1", name: "Ada" });
  });

  it("leaves `user` undefined when the token carries no user claim", async () => {
    // Which makes comments unavailable rather than anonymous — the feature's own
    // gate, asserted in `useCommentsFeature.test.ts`.
    mockAuthManager.userConfig = null;
    try {
      const { user } = await bootstrap();
      expect(user).toBe(undefined);
    } finally {
      mockAuthManager.userConfig = {
        id: "u-1",
        name: "Ada",
        signature: "sig-1",
      };
    }
  });

  it("folds the plan feature, the consumer's opt-out and 'the template is saved'", async () => {
    const { runtime } = await bootstrap();
    const { editor } = attachInComponent(runtime);

    // Plan grants `commenting` (the mock's `hasFeature` is true) but no template
    // is saved yet, so Cloud has nothing to anchor a thread to.
    expect(runtime.isCommentsAvailable()).toBe(false);

    editor.state.template = { id: "tmpl-1", content: { blocks: [] } };
    expect(runtime.isCommentsAvailable()).toBe(true);
  });

  it("is unavailable when the consumer passed commenting: false", async () => {
    const { runtime } = await bootstrap({ commenting: false });
    const { editor } = attachInComponent(runtime);
    editor.state.template = { id: "tmpl-1", content: { blocks: [] } };

    expect(runtime.isCommentsAvailable()).toBe(false);
  });

  it("is unavailable when the plan withholds `commenting`", async () => {
    vi.mocked(usePlanConfig).mockReturnValueOnce({
      config: ref({ websocket: { host: "h", port: 1, app_key: "k" } }),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn((feature: string) => feature !== "commenting"),
    } as any);

    const { runtime } = await bootstrap();
    const { editor } = attachInComponent(runtime);
    editor.state.template = { id: "tmpl-1", content: { blocks: [] } };

    expect(runtime.isCommentsAvailable()).toBe(false);
  });
});

describe("CloudRuntime.destroy", () => {
  it("closes the websocket and calls the consumer's onUnmount", async () => {
    const onUnmount = vi.fn();
    const { runtime } = await bootstrap({ onUnmount });
    const { attachment } = attachInComponent(runtime);

    runtime.destroy();

    expect(attachment.websocket.disconnect).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });
});
