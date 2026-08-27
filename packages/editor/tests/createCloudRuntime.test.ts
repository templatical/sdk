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
 * keys are refused, and the `attach` / `ready` hooks that must run at a
 * specific point inside the shared editor's `setup()`.
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
  createCloudTestEmailProvider,
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
  vi.mocked(createCloudTestEmailProvider).mockClear();
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
    // Not a `toBe` on the whole object: `versionHistory` merges the
    // consumer's events onto Cloud's adapter the same way `comments` does, so
    // the result is a new object even with no events configured. Per-method
    // equality is what actually matters — Cloud's storage methods must be
    // the ones core receives.
    const base = vi.mocked(createCloudVersionHistoryProvider).mock.results[0]
      .value;
    expect(providers.versionHistory.list).toBe(base.list);
    expect(providers.versionHistory.get).toBe(base.get);
    expect(providers.versionHistory.create).toBe(base.create);
    expect(providers.versionHistory.restore).toBe(base.restore);
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

  it("does not call the consumer's templates events itself — core does, once mounted", async () => {
    // `onCreated` / `onLoaded` ride the provider object via `eventsOf`, but core
    // is what invokes them after the editor has settled — the adapter itself
    // must not call them a second time from inside `load` / `create`.
    const onCreated = vi.fn();
    const onLoaded = vi.fn();
    const { runtime, providers } = await bootstrap({
      templates: { onCreated, onLoaded },
    });
    attachInComponent(runtime);

    await providers.templates.load("tmpl-1");
    await (providers.templates.create as any)({ content: {} });

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
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

  it("is unavailable when the plan withholds saved_modules, even with an events-only value", async () => {
    // The second-order bug: an events-only object is truthy, so keying
    // availability off the raw config value (rather than the discriminated
    // provider) would read this as "consumer's own store" and skip the plan
    // check entirely.
    withoutPlanFeature();
    const { runtime } = await bootstrap({
      savedBlocks: { onCreated: vi.fn() },
    });
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

describe("bootstrapCloud — the keys initCloud refuses, wholly or in part", () => {
  it("ignores a templates key's methods, keeps its events, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supplied = { load: vi.fn(), create: false, save: false };

    const { providers } = await bootstrap({ templates: supplied });

    expect(supplied.load).not.toHaveBeenCalled();
    expect(providers.templates).not.toBe(supplied);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores templates.load"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("comma-lists three ignored methods with a final 'and', not 'a and b and c'", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supplied = { load: vi.fn(), create: vi.fn(), save: vi.fn() };

    await bootstrap({ templates: supplied });

    expect(
      warn.mock.calls.some((a) =>
        a
          .join(" ")
          .includes(
            "initCloud ignores templates.load, templates.create and templates.save",
          ),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("warns about a stated-but-ignored templates decision even with no function override", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { providers } = await bootstrap({
      templates: { save: false, onSaved: vi.fn() },
    });

    expect(providers.templates.save).not.toBe(false);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores templates.save"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a consumer-supplied versionHistory key's storage methods, keeps its events, and says so", async () => {
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
        a.join(" ").includes("initCloud ignores versionHistory.list"),
      ),
    ).toBe(true);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("event handlers were kept"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a consumer-supplied comments key's storage methods, keeps its events, and says so", async () => {
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
    expect(providers.comments.list).not.toBe(supplied.list);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores comments.list"),
      ),
    ).toBe(true);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("event handlers were kept"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a consumer-supplied comments key's subscribe, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mySSE = vi.fn(() => () => {});
    const supplied = { subscribe: mySSE, onCreated: vi.fn() };

    const { providers } = await bootstrap({ comments: supplied });

    expect(providers.comments.subscribe).not.toBe(mySSE);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores comments.subscribe"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("warns about a stated-but-ignored decision even with no function override", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { providers } = await bootstrap({
      comments: { create: false, onCreated: vi.fn() },
    });

    expect(providers.comments.create).not.toBe(false);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores comments.create"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a malformed savedBlocks value's storage methods, keeps its events, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onCreated = vi.fn();
    // No `list`, so this fails the discriminator and is read as configuration
    // for Cloud's own store rather than a replacement for it.
    const supplied = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onCreated,
    };

    const { providers } = await bootstrap({ savedBlocks: supplied });

    expect(supplied.create).not.toHaveBeenCalled();
    expect(providers.savedBlocks?.create).not.toBe(supplied.create);
    expect(providers.savedBlocks?.onCreated).toBe(onCreated);
    expect(
      warn.mock.calls.some((a) =>
        a
          .join(" ")
          .includes(
            "initCloud ignores savedBlocks.create, savedBlocks.update and savedBlocks.delete",
          ),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a testEmail value's includeMjml and allowedRecipients, keeps its events, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onSent = vi.fn();

    const { providers } = await bootstrap({
      testEmail: {
        includeMjml: true,
        allowedRecipients: ["hacker@evil.test"],
        onSent,
      } as never,
    });

    expect(providers.testEmail.includeMjml).toBeUndefined();
    expect(providers.testEmail.onSent).toBe(onSent);
    expect(
      warn.mock.calls.some((a) =>
        a
          .join(" ")
          .includes(
            "initCloud ignores testEmail.includeMjml and testEmail.allowedRecipients",
          ),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("ignores a malformed testEmail value's send, keeps its events, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onSent = vi.fn();
    // `send` is not a function, so this fails the discriminator and is read
    // as configuration for Cloud's own sender rather than a replacement for
    // it.
    const supplied = { send: null, onSent };

    const { providers } = await bootstrap({ testEmail: supplied as never });

    expect(providers.testEmail.send).not.toBe(supplied.send);
    expect(providers.testEmail.onSent).toBe(onSent);
    expect(
      warn.mock.calls.some((a) =>
        a.join(" ").includes("initCloud ignores testEmail.send"),
      ),
    ).toBe(true);
    warn.mockRestore();
  });

  it("warns about nothing when none was supplied", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await bootstrap();
    expect(
      warn.mock.calls.some(
        (a) =>
          a.join(" ").includes("does not accept") ||
          a.join(" ").includes("initCloud ignores"),
      ),
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
    // test email; Cloud contributes only `plan` and `ai`, asserted above.
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
  it("builds Cloud's adapter and hands its storage methods over as the `comments` key", async () => {
    const { providers } = await bootstrap();

    expect(createCloudCommentsProvider).toHaveBeenCalledTimes(1);
    const base = vi
      .mocked(createCloudCommentsProvider)
      .mock.results.at(-1)!.value;
    expect(providers.comments.list).toBe(base.list);
    expect(providers.comments.create).toBe(base.create);
    expect(providers.comments.update).toBe(base.update);
    expect(providers.comments.delete).toBe(base.delete);
    expect(providers.comments.setResolved).toBe(base.setResolved);
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

  it("is unavailable when the consumer passed comments: false", async () => {
    const { runtime } = await bootstrap({ comments: false });
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

describe("bootstrapCloud — templates events", () => {
  it("puts the consumer's handlers on the provider core receives", async () => {
    const onLoaded = vi.fn();
    const onSaved = vi.fn();

    const { providers } = await bootstrap({ templates: { onLoaded, onSaved } });

    expect(providers.templates.onLoaded).toBe(onLoaded);
    expect(providers.templates.onSaved).toBe(onSaved);
  });

  it("never lets a consumer method replace Cloud's own", async () => {
    // JS consumers are unchecked, and a bare spread would swap Cloud storage
    // for the consumer's on the one tier that must not allow it.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rogueSave = vi.fn();

    const { providers } = await bootstrap({
      templates: { save: rogueSave, onSaved: vi.fn() },
    });

    expect(providers.templates.save).not.toBe(rogueSave);
    expect(rogueSave).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("names the ignored methods and says the events were kept", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ templates: { load: vi.fn(), onSaved: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).toContain("templates.load");
    expect(message).toContain("event handlers were kept");
    expect(message).not.toContain("templates.save");
    warn.mockRestore();
  });

  it("drops every key that is not a declared event", async () => {
    // The whitelist's real job. The provider literal spreads events FIRST and
    // defines load/create/save after, so ordering alone already stops those
    // three from being replaced — only this pins that `eventsOf` filters
    // everything else, and only this fails if the pick becomes a raw spread.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onSaved = vi.fn();

    const { providers } = await bootstrap({
      templates: { onSaved, onFuture: vi.fn(), nonsense: 42 },
    });

    expect(providers.templates.onSaved).toBe(onSaved);
    expect("onFuture" in providers.templates).toBe(false);
    expect("nonsense" in providers.templates).toBe(false);
    warn.mockRestore();
  });

  it("drops an event member that is not a function", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { providers } = await bootstrap({
      templates: { onSaved: "yes", onCreated: null },
    });

    expect("onSaved" in providers.templates).toBe(false);
    expect("onCreated" in providers.templates).toBe(false);
    warn.mockRestore();
  });

  it("warns about nothing when only events were passed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ templates: { onSaved: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });

  it("warns about nothing for a legitimate config-and-events value", async () => {
    // `autoSave` / `unsavedChangesGuard` / `nameField` are real `TemplatesOptions`
    // config, not storage — the presence check above must not mistake them for
    // a stated-but-ignored decision just because their values aren't functions.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({
      templates: {
        autoSave: true,
        unsavedChangesGuard: false,
        nameField: false,
        onSaved: vi.fn(),
      },
    });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });
});

describe("bootstrapCloud — comments events", () => {
  it("puts the consumer's handlers on the provider core receives", async () => {
    const onCreated = vi.fn();

    const { providers } = await bootstrap({ comments: { onCreated } });

    expect(providers.comments.onCreated).toBe(onCreated);
  });

  it("never lets a consumer method replace Cloud's own", async () => {
    const rogueList = vi.fn();

    const { providers } = await bootstrap({
      comments: { list: rogueList, onCreated: vi.fn() } as never,
    });

    expect(providers.comments.list).not.toBe(rogueList);
    expect(rogueList).not.toHaveBeenCalled();
  });

  it("drops every key that is not a declared event", async () => {
    const onCreated = vi.fn();

    const { providers } = await bootstrap({
      comments: { onCreated, onFuture: vi.fn(), nonsense: 42 } as never,
    });

    expect(providers.comments.onCreated).toBe(onCreated);
    expect("onFuture" in providers.comments).toBe(false);
    expect("nonsense" in providers.comments).toBe(false);
  });

  it("drops an event member that is not a function", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { providers } = await bootstrap({
      comments: { onCreated: "yes", onUpdated: null } as never,
    });

    expect("onCreated" in providers.comments).toBe(false);
    expect("onUpdated" in providers.comments).toBe(false);
    warn.mockRestore();
  });

  it("warns about nothing when only events were passed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ comments: { onCreated: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });
});

/**
 * `config.savedBlocks` also accepts a `SavedBlocksOptions`-shaped value —
 * events only, no storage methods — which must keep Cloud's own adapter in
 * place and attach the handlers to it. The discriminator is `list`, never
 * `typeof === "object"`: an events-only value (`{ onCreated }`) is an object
 * too, and reading it as the provider would leave `list` undefined and crash
 * the library on first browse.
 */
describe("bootstrapCloud — savedBlocks events", () => {
  it("keeps Cloud's adapter and attaches the handler for an events-only value", async () => {
    const onCreated = vi.fn();

    const { providers } = await bootstrap({ savedBlocks: { onCreated } });

    expect(createCloudSavedBlocksProvider).toHaveBeenCalledTimes(1);
    expect(providers.savedBlocks?.onCreated).toBe(onCreated);
    expect(typeof providers.savedBlocks?.list).toBe("function");
  });

  it("never lets a consumer method replace Cloud's own", async () => {
    // Not `list`: supplying one is what makes an object a full provider (see
    // "bootstrapCloud — savedBlocks provider selection" above) — the case
    // worth proving here is the *other* storage methods, which stay outside
    // `SavedBlocksOptions` and so must not reach Cloud's adapter either.
    const rogueCreate = vi.fn();

    const { providers } = await bootstrap({
      savedBlocks: { create: rogueCreate, onCreated: vi.fn() } as never,
    });

    expect(providers.savedBlocks?.create).not.toBe(rogueCreate);
    expect(rogueCreate).not.toHaveBeenCalled();
  });

  it("drops every key that is not a declared event", async () => {
    const onCreated = vi.fn();

    const { providers } = await bootstrap({
      savedBlocks: { onCreated, onFuture: vi.fn(), nonsense: 42 } as never,
    });

    expect(providers.savedBlocks?.onCreated).toBe(onCreated);
    expect("onFuture" in (providers.savedBlocks as object)).toBe(false);
    expect("nonsense" in (providers.savedBlocks as object)).toBe(false);
  });

  it("drops an event member that is not a function", async () => {
    const { providers } = await bootstrap({
      savedBlocks: { onCreated: "yes", onUpdated: null } as never,
    });

    expect("onCreated" in (providers.savedBlocks as object)).toBe(false);
    expect("onUpdated" in (providers.savedBlocks as object)).toBe(false);
  });

  it("warns about nothing when only events were passed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ savedBlocks: { onCreated: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });
});

/**
 * `config.testEmail` accepts a `TestEmailOptions`-shaped value — events only
 * — the same way `savedBlocks` does. The discriminator is `send`, never raw
 * truthiness: an events-only value (`{ onSent }`) is truthy too, and reading
 * it as the provider would leave `send` undefined and crash the dialog on
 * send.
 */
describe("bootstrapCloud — testEmail provider selection", () => {
  it("builds Cloud's adapter when the key is omitted", async () => {
    const { providers, runtime } = await bootstrap();
    // `isTestEmailAvailable` also requires a saved template (Cloud renders
    // from the saved copy), unlike `isSavedBlocksAvailable` — attach and
    // give it one so this exercises the plan-feature branch, not that gate.
    const { editor } = attachInComponent(runtime);
    editor.state.template = { id: "tmpl-1", content: { blocks: [] } };

    expect(createCloudTestEmailProvider).toHaveBeenCalledTimes(1);
    expect(providers.testEmail).toBeTypeOf("object");
    expect(runtime.isTestEmailAvailable()).toBe(true);
  });

  it("uses a consumer's sender without constructing Cloud's, and never plan-gates it", async () => {
    vi.mocked(usePlanConfig).mockReturnValueOnce({
      config: ref(null),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => false),
    } as any);
    const supplied = { send: vi.fn().mockResolvedValue(undefined) };

    const { providers, runtime } = await bootstrap({ testEmail: supplied });

    expect(createCloudTestEmailProvider).not.toHaveBeenCalled();
    expect(providers.testEmail).toBe(supplied);
    // `test_email` licenses Cloud's sending; someone else's infrastructure
    // isn't Cloud's to sell.
    expect(runtime.isTestEmailAvailable()).toBe(true);
  });

  it("is unavailable when the plan withholds test_email, even with an events-only value", async () => {
    // The second-order bug: an events-only object is truthy, so keying
    // availability off the raw config value (rather than the discriminated
    // provider) would read this as "consumer's own sender" and skip the plan
    // check entirely. Attach and save a template first — `isTestEmailAvailable`
    // also requires `hasTemplateSaved`, so without this the assertion would
    // pass on that gate alone and never actually exercise the plan check.
    vi.mocked(usePlanConfig).mockReturnValueOnce({
      config: ref(null),
      fetchConfig: vi.fn().mockResolvedValue(undefined),
      hasFeature: vi.fn(() => false),
    } as any);

    const { runtime } = await bootstrap({ testEmail: { onSent: vi.fn() } });
    const { editor } = attachInComponent(runtime);
    editor.state.template = { id: "tmpl-1", content: { blocks: [] } };

    expect(runtime.isTestEmailAvailable()).toBe(false);
  });
});

describe("bootstrapCloud — testEmail events", () => {
  it("keeps Cloud's sender and attaches the handler for an events-only value", async () => {
    const onSent = vi.fn();

    const { providers } = await bootstrap({ testEmail: { onSent } });

    expect(createCloudTestEmailProvider).toHaveBeenCalledTimes(1);
    expect(providers.testEmail.onSent).toBe(onSent);
    expect(typeof providers.testEmail.send).toBe("function");
  });

  // No "never lets a consumer method replace Cloud's own" case here, unlike
  // `savedBlocks`: `send` is `TestEmailProvider`'s only storage method, and
  // supplying one is exactly what makes an object a full provider (see
  // "bootstrapCloud — testEmail provider selection" above) — there is no
  // *other* storage method left to prove the whitelist keeps out. The
  // "forwards defaultRecipient but not includeMjml or allowedRecipients"
  // case below covers the equivalent concern for this provider's shape.

  it("drops every key that is not a declared event", async () => {
    const onSent = vi.fn();

    const { providers } = await bootstrap({
      testEmail: { onSent, onFuture: vi.fn(), nonsense: 42 } as never,
    });

    expect(providers.testEmail.onSent).toBe(onSent);
    expect("onFuture" in providers.testEmail).toBe(false);
    expect("nonsense" in providers.testEmail).toBe(false);
  });

  it("drops an event member that is not a function", async () => {
    const { providers } = await bootstrap({
      testEmail: { onSent: "yes" } as never,
    });

    expect("onSent" in providers.testEmail).toBe(false);
  });

  // `includeMjml` / `allowedRecipients` stay Cloud's own whenever Cloud's
  // sender is in play — Cloud never renders MJML client-side (it renders
  // server-side), and the allowlist is the signed one from the project's
  // JWT, not a client-supplied one. `defaultRecipient` has no such conflict:
  // Cloud's provider never defines it, and `useTestEmailFeature` already
  // discards a value outside `allowedRecipients`, so it crosses over
  // alongside `onSent`.
  it("forwards defaultRecipient but not includeMjml or allowedRecipients onto Cloud's sender", async () => {
    const { providers } = await bootstrap({
      testEmail: {
        onSent: vi.fn(),
        includeMjml: true,
        allowedRecipients: ["hacker@evil.test"],
        defaultRecipient: "ceo@templatical.test",
      } as never,
    });

    expect(providers.testEmail.includeMjml).toBeUndefined();
    expect(providers.testEmail.defaultRecipient).toBe("ceo@templatical.test");
    // Cloud's own signed list, not the consumer's — proven precisely below.
    expect(providers.testEmail.allowedRecipients).toEqual([
      "qa@templatical.test",
    ]);
  });

  it("drops a defaultRecipient that is not a string", async () => {
    const { providers } = await bootstrap({
      testEmail: { onSent: vi.fn(), defaultRecipient: 42 } as never,
    });

    expect("defaultRecipient" in providers.testEmail).toBe(false);
  });

  it("warns about nothing when only events were passed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ testEmail: { onSent: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });

  /**
   * `createCloudTestEmailProvider` exposes `allowedRecipients` as a **getter**
   * over a value that fills in after auth resolves (see the class's own doc
   * comment). A spread-based merge (`{ ...events, ...cloudProvider }`) would
   * read the getter once, through `[[Get]]`, and freeze the result as a plain
   * value on the new object — silently reintroducing the exact bug
   * `useTestEmailFeature`'s "never destructure the provider" rule exists to
   * prevent. This proves the merge keeps it live by mutating the source the
   * getter reads from and re-reading through the merged provider.
   */
  it("keeps allowedRecipients live rather than freezing it at merge time", async () => {
    let recipients = ["a@x.test"];
    vi.mocked(createCloudTestEmailProvider).mockReturnValueOnce({
      send: vi.fn().mockResolvedValue(undefined),
      get allowedRecipients() {
        return recipients;
      },
    } as any);

    const { providers } = await bootstrap({
      testEmail: { onSent: vi.fn() },
    });

    expect(providers.testEmail.allowedRecipients).toEqual(["a@x.test"]);
    recipients = ["b@y.test"];
    expect(providers.testEmail.allowedRecipients).toEqual(["b@y.test"]);

    const descriptor = Object.getOwnPropertyDescriptor(
      providers.testEmail,
      "allowedRecipients",
    );
    expect(typeof descriptor?.get).toBe("function");
  });
});

/**
 * `config.versionHistory` takes the same treatment `comments` already has:
 * storage methods are refused by name in a warning, and its `onCreated` /
 * `onRestored` events reach Cloud's own adapter. It never accepts a full
 * provider — a version is keyed to a template id Cloud issued, so a
 * consumer-supplied history would run alongside the automatic versions
 * Cloud's templates adapter keeps recording.
 */
describe("bootstrapCloud — versionHistory events", () => {
  it("puts the consumer's handler on the provider core receives", async () => {
    const onRestored = vi.fn();

    const { providers } = await bootstrap({ versionHistory: { onRestored } });

    expect(providers.versionHistory.onRestored).toBe(onRestored);
  });

  it("never lets a consumer method replace Cloud's own", async () => {
    const rogueRestore = vi.fn();

    const { providers } = await bootstrap({
      versionHistory: { restore: rogueRestore, onRestored: vi.fn() } as never,
    });

    expect(providers.versionHistory.restore).not.toBe(rogueRestore);
    expect(rogueRestore).not.toHaveBeenCalled();
  });

  it("drops every key that is not a declared event", async () => {
    const onRestored = vi.fn();

    const { providers } = await bootstrap({
      versionHistory: {
        onRestored,
        onFuture: vi.fn(),
        nonsense: 42,
      } as never,
    });

    expect(providers.versionHistory.onRestored).toBe(onRestored);
    expect("onFuture" in providers.versionHistory).toBe(false);
    expect("nonsense" in providers.versionHistory).toBe(false);
  });

  it("drops an event member that is not a function", async () => {
    const { providers } = await bootstrap({
      versionHistory: { onCreated: "yes", onRestored: null } as never,
    });

    expect("onCreated" in providers.versionHistory).toBe(false);
    expect("onRestored" in providers.versionHistory).toBe(false);
  });

  it("warns about nothing when only events were passed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootstrap({ versionHistory: { onRestored: vi.fn() } });

    const message = warn.mock.calls.map((a) => a.join(" ")).join("\n");
    expect(message).not.toContain("initCloud ignores");
    warn.mockRestore();
  });
});
