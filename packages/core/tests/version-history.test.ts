import { describe, expect, it, vi } from "vitest";
import { useVersionHistory } from "../src/version-history";
import type {
  Template,
  TemplateContent,
  TemplateVersion,
  VersionHistoryProvider,
} from "@templatical/types";

/**
 * Reactive state over a `VersionHistoryProvider`.
 *
 * The load-bearing case here is the split between `TemplateVersion.content` (a
 * per-entry cache hint) and `get` (the operation). A provider that hydrates its
 * list must never be asked for content it already handed over — that is what
 * keeps scrubbing through history synchronous — while one that omits it must
 * pay exactly one round-trip per version and none afterwards.
 */

function content(marker: string): TemplateContent {
  return {
    blocks: [{ id: marker, type: "paragraph", text: marker }],
    settings: {},
  } as unknown as TemplateContent;
}

function version(
  id: string,
  overrides: Partial<TemplateVersion> = {},
): TemplateVersion {
  return { id, createdAt: "2026-08-16T10:00:00Z", ...overrides };
}

function setup(
  overrides: Partial<VersionHistoryProvider> = {},
  options: { templateId?: string | null; onError?: (e: Error) => void } = {},
) {
  const provider: VersionHistoryProvider = {
    list: vi.fn(async () => ({ versions: [] as TemplateVersion[] })),
    get: vi.fn(async () => content("fetched")),
    create: vi.fn(async (_t: string, c: TemplateContent) => ({
      id: "ver-new",
      createdAt: "2026-08-16T11:00:00Z",
      content: c,
    })),
    restore: vi.fn(async () => ({ id: "tpl-1", content: content("restored") })),
    ...overrides,
  };
  const history = useVersionHistory({
    provider,
    getTemplateId: () =>
      options.templateId === undefined ? "tpl-1" : options.templateId,
    onError: options.onError,
  });
  return { provider, history };
}

describe("useVersionHistory", () => {
  describe("list", () => {
    /**
     * `list` resolves to an envelope rather than a bare array so that pagination
     * can be added without a breaking change — a cursor has somewhere to live
     * from day one. These pin that the cursor actually reaches a caller and that
     * its absence is reported as absent, not as a stale value.
     */
    it("surfaces the provider's nextCursor, and forwards params back", async () => {
      const list = vi.fn(async () => ({
        versions: [version("ver-1")],
        nextCursor: "page-2",
      }));
      const { history, provider } = setup({ list });

      await history.load({ limit: 1 });

      expect(history.nextCursor.value).toBe("page-2");
      expect(provider.list).toHaveBeenCalledWith("tpl-1", { limit: 1 });

      // A provider that stops paginating clears it rather than leaving it stale.
      list.mockResolvedValueOnce({ versions: [version("ver-2")] } as never);
      await history.load({ cursor: "page-2" });
      expect(history.nextCursor.value).toBeUndefined();
      expect(history.versions.value.map((v) => v.id)).toEqual(["ver-2"]);
    });

    it("stores what the provider returned, in the provider's order", async () => {
      const entries = [version("ver-3"), version("ver-2"), version("ver-1")];
      const { history, provider } = setup({ list: vi.fn(async () => ({ versions: entries })) });

      await history.load();

      expect(history.versions.value.map((v) => v.id)).toEqual([
        "ver-3",
        "ver-2",
        "ver-1",
      ]);
      expect(provider.list).toHaveBeenCalledWith("tpl-1", undefined);
      expect(history.isLoading.value).toBe(false);
    });

    it("forwards params for a headless caller", async () => {
      const { history, provider } = setup();
      await history.load({});
      expect(provider.list).toHaveBeenCalledWith("tpl-1", {});
    });

    it("reports the failure and re-throws, leaving the list untouched", async () => {
      const onError = vi.fn();
      const error = new Error("list failed");
      const { history } = setup({ list: vi.fn(async () => { throw error; }) }, {
        onError,
      });

      await expect(history.load()).rejects.toThrow("list failed");
      expect(onError).toHaveBeenCalledWith(error);
      expect(history.versions.value).toEqual([]);
      expect(history.isLoading.value).toBe(false);
    });

    it("refuses rather than listing nothing when no template is attached", async () => {
      const { history, provider } = setup({}, { templateId: null });
      await expect(history.load()).rejects.toThrow(
        "list needs a template",
      );
      expect(provider.list).not.toHaveBeenCalled();
    });
  });

  describe("the content hint and the get fallback", () => {
    it("peeks a hydrated entry synchronously and never calls get", async () => {
      const hinted = version("ver-1", { content: content("hinted") });
      const { history, provider } = setup({ list: vi.fn(async () => ({ versions: [hinted] })) });
      await history.load();

      expect(history.peekContent(hinted)).toEqual(content("hinted"));
      await expect(history.resolveContent(hinted)).resolves.toEqual(
        content("hinted"),
      );
      expect(provider.get).not.toHaveBeenCalled();
    });

    it("evaluates the hint per entry — one hydrated, one not", async () => {
      const hinted = version("ver-2", { content: content("hinted") });
      const bare = version("ver-1");
      const { history, provider } = setup({
        list: vi.fn(async () => ({ versions: [hinted, bare] })),
      });
      await history.load();

      expect(history.peekContent(hinted)).toEqual(content("hinted"));
      expect(history.peekContent(bare)).toBeNull();

      await expect(history.resolveContent(bare)).resolves.toEqual(
        content("fetched"),
      );
      expect(provider.get).toHaveBeenCalledTimes(1);
      expect(provider.get).toHaveBeenCalledWith("tpl-1", "ver-1");
    });

    it("caches a fetched version, so the second visit is synchronous too", async () => {
      const bare = version("ver-1");
      const { history, provider } = setup({ list: vi.fn(async () => ({ versions: [bare] })) });
      await history.load();

      await history.resolveContent(bare);
      expect(history.peekContent(bare)).toEqual(content("fetched"));

      await expect(history.resolveContent(bare)).resolves.toEqual(
        content("fetched"),
      );
      expect(provider.get).toHaveBeenCalledTimes(1);
    });

    it("reports a failed get and re-throws", async () => {
      const onError = vi.fn();
      const error = new Error("get failed");
      const { history } = setup(
        { get: vi.fn(async () => { throw error; }) },
        { onError },
      );

      await expect(history.resolveContent(version("ver-1"))).rejects.toThrow(
        "get failed",
      );
      expect(onError).toHaveBeenCalledWith(error);
      expect(history.peekContent(version("ver-1"))).toBeNull();
    });
  });

  describe("create", () => {
    it("prepends the created version", async () => {
      const { history, provider } = setup({
        list: vi.fn(async () => ({ versions: [version("ver-1")] })),
      });
      await history.load();

      const created = await history.create(content("current"), {
        label: "Before launch",
      });

      expect(created.id).toBe("ver-new");
      expect(history.versions.value.map((v) => v.id)).toEqual([
        "ver-new",
        "ver-1",
      ]);
      expect(provider.create).toHaveBeenCalledWith("tpl-1", content("current"), {
        label: "Before launch",
      });
    });

    it("rejects rather than resolving when the provider withheld create", async () => {
      const { history } = setup({ create: false });
      expect(history.canCreate.value).toBe(false);
      await expect(history.create(content("x"))).rejects.toThrow(
        "create is disabled by the provider",
      );
    });
  });

  describe("restore", () => {
    it("returns the resulting template and clears isRestoring", async () => {
      const { history, provider } = setup();

      const template: Template = await history.restore("ver-1");

      expect(template.content).toEqual(content("restored"));
      expect(provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(history.isRestoring.value).toBe(false);
    });

    it("rejects rather than resolving when the provider withheld restore", async () => {
      const { history, provider } = setup({ restore: false });
      expect(history.canRestore.value).toBe(false);
      await expect(history.restore("ver-1")).rejects.toThrow(
        "restore is disabled by the provider",
      );
      expect(provider.list).not.toHaveBeenCalled();
    });

    it("reports a failure, re-throws and still clears isRestoring", async () => {
      const onError = vi.fn();
      const error = new Error("restore failed");
      const { history } = setup(
        { restore: vi.fn(async () => { throw error; }) },
        { onError },
      );

      await expect(history.restore("ver-1")).rejects.toThrow("restore failed");
      expect(onError).toHaveBeenCalledWith(error);
      expect(history.isRestoring.value).toBe(false);
    });
  });

  describe("events", () => {
    it("fires onCreated once with the created version", async () => {
      const onCreated = vi.fn();
      const { history } = setup({ onCreated });

      const created = await history.create(content("current"));

      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(created);
    });

    it("keeps create successful when onCreated throws, and reports through onError", async () => {
      const onError = vi.fn();
      const { history } = setup(
        {
          onCreated: () => {
            throw new Error("handler blew up");
          },
        },
        { onError },
      );

      await expect(history.create(content("x"))).resolves.toMatchObject({
        id: "ver-new",
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe("handler blew up");
    });

    /**
     * `restore()` clears `isRestoring` in a `finally`, which runs after the
     * `return` expression evaluates. Capturing the flag from inside the
     * handler pins that the emit sits below the whole `try/catch/finally` —
     * an emit placed inside the `try` would fire while the composable still
     * reports itself mid-restore.
     */
    it("fires onRestored once with the resulting template, observing isRestoring already settled", async () => {
      const onRestored = vi.fn();
      let observedWhileRestoring: boolean | null = null;
      const { history } = setup({
        onRestored: (template) => {
          observedWhileRestoring = history.isRestoring.value;
          onRestored(template);
        },
      });

      const template = await history.restore("ver-1");

      expect(onRestored).toHaveBeenCalledTimes(1);
      expect(onRestored).toHaveBeenCalledWith(template);
      expect(observedWhileRestoring).toBe(false);
    });

    it("keeps restore successful when onRestored throws, and reports through onError", async () => {
      const onError = vi.fn();
      const { history } = setup(
        {
          onRestored: () => {
            throw new Error("handler blew up");
          },
        },
        { onError },
      );

      await expect(history.restore("ver-1")).resolves.toMatchObject({
        id: "tpl-1",
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toBe("handler blew up");
    });
  });

  describe("capability flags", () => {
    it("reads both mutations off the provider", () => {
      const { history } = setup();
      expect(history.canCreate.value).toBe(true);
      expect(history.canRestore.value).toBe(true);
    });
  });
});
