import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { effectScope, ref } from "vue";
import type {
  TemplateContent,
  TemplateVersion,
  VersionHistoryProvider,
} from "@templatical/types";
import { useVersionHistoryFeature } from "../src/composables/useVersionHistoryFeature";

/**
 * The editor-side seam both editors share.
 *
 * The case that matters most here is **synchronous scrubbing**: once the preview
 * is open, stepping to another version whose content is already in hand must
 * swap the canvas in the same tick. A provider that hydrates its list (Cloud
 * does) is the common case, and turning that into an async hop would visibly
 * regress the feature's primary interaction — so it is asserted by observing
 * `setContent` *before* awaiting anything.
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
  providerOverrides: Partial<VersionHistoryProvider> = {},
  opts: {
    isDirty?: boolean;
    templateId?: string | null;
    /** `null` mirrors "no templates provider"; `false` mirrors `save: false`. */
    saveBeforeRestore?: null | false | { save?: () => Promise<unknown> };
  } = {},
) {
  const provider: VersionHistoryProvider = {
    list: vi.fn(async () => ({ versions: [] as TemplateVersion[] })),
    get: vi.fn(async () => content("fetched")),
    create: vi.fn(async () => version("ver-safety")),
    restore: vi.fn(async () => ({
      id: "tpl-1",
      content: content("restored"),
    })),
    ...providerOverrides,
  };

  const state = {
    template:
      opts.templateId === null ? null : { id: opts.templateId ?? "tpl-1" },
    isDirty: opts.isDirty ?? false,
  };
  const editor = {
    state,
    content: ref(content("current")),
    setContent: vi.fn((next: TemplateContent) => {
      editor.content.value = next;
    }),
  };
  const history = { clear: vi.fn() } as never as {
    clear: ReturnType<typeof vi.fn>;
  };
  const conditionPreview = { reset: vi.fn() };
  const autoSave = { pause: vi.fn(), resume: vi.fn() };
  const onError = vi.fn();

  // Defaults to a working save, since that is the arrangement every editor with
  // a templates provider has. `null` / `false` are the two degraded shapes.
  const supplied = opts.saveBeforeRestore;
  const save = vi.fn(
    supplied && supplied.save
      ? supplied.save
      : async () => {
          state.isDirty = false;
        },
  );
  const saveBeforeRestore =
    supplied === null ? null : { canSave: () => supplied !== false, save };

  const scope = effectScope();
  const feature = scope.run(() =>
    useVersionHistoryFeature({
      provider,
      editor: editor as never,
      history: history as never,
      conditionPreview: conditionPreview as never,
      autoSave: autoSave as never,
      saveBeforeRestore,
      onError,
    }),
  )!;

  return {
    provider,
    editor,
    history,
    conditionPreview,
    autoSave,
    onError,
    save,
    feature,
    scope,
    state,
  };
}

describe("useVersionHistoryFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("availability", () => {
    it("is available with a provider and reports the template gate separately", () => {
      const { feature } = setup();
      expect(feature.isAvailable.value).toBe(true);
      expect(feature.hasTemplate.value).toBe(true);
    });

    it("has no template gate before create()/load() resolves", () => {
      const { feature } = setup({}, { templateId: null });
      expect(feature.hasTemplate.value).toBe(false);
    });

    it("refresh is a no-op without a template rather than an error", async () => {
      const { feature, provider } = setup({}, { templateId: null });
      feature.refresh();
      await Promise.resolve();
      expect(provider.list).not.toHaveBeenCalled();
    });

    it("refresh reads the list through the provider", async () => {
      const { feature, provider } = setup({
        list: vi.fn(async () => ({ versions: [version("ver-1")] })),
      });
      feature.refresh();
      await vi.waitFor(() =>
        expect(feature.versions.value.map((v) => v.id)).toEqual(["ver-1"]),
      );
      expect(provider.list).toHaveBeenCalledWith("tpl-1", undefined);
    });
  });

  describe("entering the preview", () => {
    it("pauses autosave, keeps the pre-preview content and shows the version", async () => {
      const target = version("ver-1", { content: content("v1") });
      const { feature, editor, autoSave } = setup();

      await feature.navigate(target);

      expect(feature.isPreviewing.value).toBe(true);
      expect(feature.previewingVersion.value?.id).toBe("ver-1");
      expect(autoSave.pause).toHaveBeenCalledOnce();
      expect(editor.setContent).toHaveBeenCalledWith(content("v1"), false);
    });

    it("resolves through get when the entry carries no content", async () => {
      const { feature, provider, editor } = setup();

      await feature.navigate(version("ver-1"));

      expect(provider.get).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(editor.setContent).toHaveBeenCalledWith(content("fetched"), false);
    });

    it("leaves the user editing when the fetch fails", async () => {
      const { feature, editor, onError } = setup({
        get: vi.fn(async () => {
          throw new Error("get failed");
        }),
      });

      await expect(feature.navigate(version("ver-1"))).rejects.toThrow(
        "get failed",
      );

      expect(feature.isPreviewing.value).toBe(false);
      expect(editor.setContent).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });

    // The build this replaced recorded a "safety version" here when the editor
    // was dirty. That made the editor a version author — which the contract says
    // it never is — and it silently vanished under `create: false`, i.e. exactly
    // when the provider had been most restrictive. The unsaved work is now
    // protected at the restore confirmation instead; see the "restore
    // confirmation" describe.
    it("records nothing, even with unsaved work — the editor never authors a version", async () => {
      const { feature, provider } = setup({}, { isDirty: true });

      await feature.navigate(version("ver-1", { content: content("v1") }));

      expect(provider.create).not.toHaveBeenCalled();
      expect(feature.isPreviewing.value).toBe(true);
    });

    it("records nothing when there is no unsaved work", async () => {
      const { feature, provider } = setup({}, { isDirty: false });
      await feature.navigate(version("ver-1", { content: content("v1") }));
      expect(provider.create).not.toHaveBeenCalled();
    });

    it("previews identically whether or not the provider allows create", async () => {
      const { feature } = setup({ create: false }, { isDirty: true });
      await feature.navigate(version("ver-1", { content: content("v1") }));
      expect(feature.isPreviewing.value).toBe(true);
      // The protection does not depend on `create` at all.
      expect(feature.canCreate.value).toBe(false);
    });
  });

  describe("scrubbing", () => {
    it("swaps the canvas synchronously when the content is already in hand", async () => {
      const first = version("ver-2", { content: content("v2") });
      const second = version("ver-1", { content: content("v1") });
      const { feature, editor, provider } = setup();

      await feature.navigate(first);
      editor.setContent.mockClear();

      // Deliberately not awaited: the swap must have happened by the time
      // `navigate` returns control, not on a later microtask.
      const pending = feature.navigate(second);
      expect(editor.setContent).toHaveBeenCalledWith(content("v1"), false);
      expect(feature.previewingVersion.value?.id).toBe("ver-1");
      expect(provider.get).not.toHaveBeenCalled();

      await pending;
    });

    it("falls back to an awaited get for a version the list did not hydrate", async () => {
      const hydrated = version("ver-2", { content: content("v2") });
      const bare = version("ver-1");
      const { feature, editor, provider } = setup();

      await feature.navigate(hydrated);
      editor.setContent.mockClear();

      const pending = feature.navigate(bare);
      expect(editor.setContent).not.toHaveBeenCalled();
      await pending;

      expect(provider.get).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(editor.setContent).toHaveBeenCalledWith(content("fetched"), false);
    });

    it("is synchronous on the second visit to a fetched version — the cache holds", async () => {
      const hydrated = version("ver-2", { content: content("v2") });
      const bare = version("ver-1");
      const { feature, editor, provider } = setup();

      await feature.navigate(hydrated);
      await feature.navigate(bare);
      await feature.navigate(hydrated);
      editor.setContent.mockClear();

      const pending = feature.navigate(bare);
      expect(editor.setContent).toHaveBeenCalledWith(content("fetched"), false);
      await pending;

      expect(provider.get).toHaveBeenCalledTimes(1);
    });

    it("keeps the pre-preview backup across hops, so Cancel still returns to the user's work", async () => {
      const { feature, editor } = setup({}, { isDirty: true });

      await feature.navigate(version("ver-2", { content: content("v2") }));
      await feature.navigate(version("ver-1", { content: content("v1") }));
      feature.cancelPreview();

      expect(editor.setContent).toHaveBeenLastCalledWith(
        content("current"),
        false,
      );
    });
  });

  describe("cancel", () => {
    it("puts the pre-preview content back and resumes autosave", async () => {
      const { feature, editor, autoSave } = setup();
      await feature.navigate(version("ver-1", { content: content("v1") }));

      feature.cancelPreview();

      expect(feature.isPreviewing.value).toBe(false);
      expect(editor.setContent).toHaveBeenLastCalledWith(
        content("current"),
        false,
      );
      expect(autoSave.resume).toHaveBeenCalledOnce();
    });

    it("is inert when nothing is being previewed", () => {
      const { feature, editor } = setup();
      feature.cancelPreview();
      expect(editor.setContent).not.toHaveBeenCalled();
    });
  });

  describe("restore", () => {
    it("applies the restored template, clears undo history and re-reads the list", async () => {
      const listed = [version("ver-1", { content: content("v1") })];
      const { feature, provider, editor, history, conditionPreview, autoSave } =
        setup({ list: vi.fn(async () => ({ versions: listed })) });

      await feature.navigate(listed[0]);
      await feature.confirmRestore();

      expect(provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(editor.setContent).toHaveBeenLastCalledWith(
        content("restored"),
        false,
      );
      expect(history.clear).toHaveBeenCalledOnce();
      expect(conditionPreview.reset).toHaveBeenCalledOnce();
      // Append-only: the restore added an entry, so a stale list would be wrong.
      expect(provider.list).toHaveBeenCalledTimes(1);
      expect(feature.isPreviewing.value).toBe(false);
      expect(autoSave.resume).toHaveBeenCalledOnce();
    });

    it("rolls the canvas back to the user's work when the restore fails", async () => {
      const { feature, editor, autoSave } = setup({
        restore: vi.fn(async () => {
          throw new Error("restore failed");
        }),
      });
      await feature.navigate(version("ver-1", { content: content("v1") }));

      await expect(feature.confirmRestore()).rejects.toThrow("restore failed");

      expect(editor.setContent).toHaveBeenLastCalledWith(
        content("current"),
        false,
      );
      expect(feature.isPreviewing.value).toBe(false);
      expect(autoSave.resume).toHaveBeenCalledOnce();
    });

    it("is inert when nothing is being previewed", async () => {
      const { feature, provider } = setup();
      await feature.confirmRestore();
      expect(provider.restore).not.toHaveBeenCalled();
    });

    it("reports restore: false through the capability so the action can hide", () => {
      const { feature } = setup({ restore: false });
      expect(feature.canRestore.value).toBe(false);
      expect(feature.capability.canRestore.value).toBe(false);
    });
  });

  /**
   * Where the unsaved work is actually protected. `confirmRestore` discards
   * `contentBeforePreview`, so anything unsaved would then exist nowhere — and
   * the editor is not allowed to solve that by writing a version of its own.
   */
  describe("restore confirmation", () => {
    const listed = [version("ver-1", { content: content("v1") })];

    async function preview(ctx: ReturnType<typeof setup>) {
      await ctx.feature.navigate(listed[0]);
    }

    it("restores straight away when there is nothing unsaved", async () => {
      const ctx = setup(
        { list: vi.fn(async () => ({ versions: listed })) },
        { isDirty: false },
      );
      await preview(ctx);

      await ctx.feature.requestRestore();

      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(ctx.feature.isPreviewing.value).toBe(false);
    });

    it("asks first when there are unsaved changes, restoring nothing yet", async () => {
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);

      await ctx.feature.requestRestore();

      expect(ctx.feature.isConfirmingRestore.value).toBe(true);
      expect(ctx.provider.restore).not.toHaveBeenCalled();
      // Still in the preview — the canvas must not move while the user decides.
      expect(ctx.feature.isPreviewing.value).toBe(true);
    });

    it("retracts a pending confirmation when the user scrubs to another version", async () => {
      // The confirmation names the version it was raised for, so leaving that
      // version must withdraw it — otherwise confirming would restore one the
      // user is no longer looking at.
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);
      await ctx.feature.requestRestore();
      expect(ctx.feature.isConfirmingRestore.value).toBe(true);

      await ctx.feature.navigate(version("ver-2", { content: content("v2") }));

      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.feature.previewingVersion.value?.id).toBe("ver-2");
      expect(ctx.provider.restore).not.toHaveBeenCalled();
    });

    it("offers to save first when a templates provider can save", async () => {
      const ctx = setup({}, { isDirty: true });
      expect(ctx.feature.canSaveBeforeRestore.value).toBe(true);
    });

    it("does not offer to save with no templates provider", async () => {
      const ctx = setup({}, { isDirty: true, saveBeforeRestore: null });
      expect(ctx.feature.canSaveBeforeRestore.value).toBe(false);
    });

    it("does not offer to save when the provider withheld save", async () => {
      const ctx = setup({}, { isDirty: true, saveBeforeRestore: false });
      expect(ctx.feature.canSaveBeforeRestore.value).toBe(false);
    });

    it("saves the user's work — not the previewed version — then restores", async () => {
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);
      await ctx.feature.requestRestore();

      await ctx.feature.saveAndRestore();

      expect(ctx.save).toHaveBeenCalledTimes(1);
      // The canvas was showing `v1` when Save was clicked; a save persists what
      // the editor holds, so the pre-preview content has to go back first or
      // "save first" would save the version being restored.
      expect(ctx.editor.content.value).toEqual(content("restored"));
      expect(ctx.editor.setContent.mock.calls.map((c) => c[0])).toContainEqual(
        content("current"),
      );
      expect(ctx.provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.feature.isPreviewing.value).toBe(false);
    });

    it("restores nothing and keeps the confirmation up when the save fails", async () => {
      const ctx = setup(
        { list: vi.fn(async () => ({ versions: listed })) },
        {
          isDirty: true,
          saveBeforeRestore: {
            save: async () => {
              throw new Error("save failed");
            },
          },
        },
      );
      await preview(ctx);
      await ctx.feature.requestRestore();

      await ctx.feature.saveAndRestore();

      expect(ctx.provider.restore).not.toHaveBeenCalled();
      expect(ctx.feature.isConfirmingRestore.value).toBe(true);
      expect(ctx.feature.isPreviewing.value).toBe(true);
      // The canvas is back on the previewed version, so it agrees with the
      // banner again rather than silently showing the user's work under it.
      expect(ctx.editor.setContent).toHaveBeenLastCalledWith(
        content("v1"),
        false,
      );
    });

    it("saves nothing when asked to save with no save available", async () => {
      const ctx = setup(
        { list: vi.fn(async () => ({ versions: listed })) },
        { isDirty: true, saveBeforeRestore: false },
      );
      await preview(ctx);
      await ctx.feature.requestRestore();

      await ctx.feature.saveAndRestore();

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.provider.restore).not.toHaveBeenCalled();
    });

    it("discards and restores when the user chooses to", async () => {
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);
      await ctx.feature.requestRestore();

      await ctx.feature.discardAndRestore();

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
    });

    it("cancelling the confirmation leaves the preview untouched", async () => {
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);
      await ctx.feature.requestRestore();

      ctx.feature.cancelRestoreConfirm();

      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.feature.isPreviewing.value).toBe(true);
      expect(ctx.provider.restore).not.toHaveBeenCalled();
      expect(ctx.autoSave.resume).not.toHaveBeenCalled();
    });

    it("cancelling the whole preview closes the confirmation too", async () => {
      const ctx = setup({ list: vi.fn(async () => ({ versions: listed })) }, { isDirty: true });
      await preview(ctx);
      await ctx.feature.requestRestore();

      ctx.feature.cancelPreview();

      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.feature.isPreviewing.value).toBe(false);
    });

    it("refuses a second save while the first is in flight", async () => {
      let release!: () => void;
      const ctx = setup(
        { list: vi.fn(async () => ({ versions: listed })) },
        {
          isDirty: true,
          saveBeforeRestore: {
            save: () =>
              new Promise<void>((resolve) => {
                release = resolve;
              }),
          },
        },
      );
      await preview(ctx);
      await ctx.feature.requestRestore();

      const first = ctx.feature.saveAndRestore();
      expect(ctx.feature.isConfirmBusy.value).toBe(true);
      await ctx.feature.saveAndRestore();
      expect(ctx.save).toHaveBeenCalledTimes(1);

      release();
      await first;
      expect(ctx.feature.isConfirmBusy.value).toBe(false);
    });

    it("is inert with nothing previewed", async () => {
      const ctx = setup({}, { isDirty: true });

      await ctx.feature.requestRestore();

      expect(ctx.feature.isConfirmingRestore.value).toBe(false);
      expect(ctx.provider.restore).not.toHaveBeenCalled();
    });
  });

  describe("post-unmount safety", () => {
    it("writes nothing after the scope is disposed mid-fetch", async () => {
      let release!: (value: TemplateContent) => void;
      const ctx = setup({
        get: vi.fn(
          () =>
            new Promise<TemplateContent>((resolve) => {
              release = resolve;
            }),
        ),
      });

      const pending = ctx.feature.navigate(version("ver-1"));
      ctx.scope.stop();
      release(content("late"));
      await pending;

      expect(ctx.feature.isPreviewing.value).toBe(false);
      expect(ctx.editor.setContent).not.toHaveBeenCalled();
      expect(ctx.autoSave.pause).not.toHaveBeenCalled();
    });
  });

  describe("capability", () => {
    it("exposes exactly what shared chrome gates on", () => {
      const { feature } = setup();
      expect(Object.keys(feature.capability).sort()).toEqual([
        "canCreate",
        "canRestore",
        "hasTemplate",
        "isAvailable",
        "isPreviewing",
        "refresh",
      ]);
    });
  });
});
