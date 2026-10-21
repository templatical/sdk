import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import type {
  TemplateContent,
  TemplateVersion,
  VersionHistoryProvider,
} from "@templatical/types";
import { useVersionHistoryFeature } from "../src/composables/useVersionHistoryFeature";

/**
 * A restore with a collaboration provider, where the editor fetches the
 * restored content like every other editor: what happens when the editor is
 * torn down while that fetch runs, and when a refusal names no holders.
 */

function content(marker: string): TemplateContent {
  return {
    blocks: [{ id: marker, type: "paragraph", text: marker }],
    settings: {},
  } as unknown as TemplateContent;
}

/** Let promise chains run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

const VERSION: TemplateVersion = {
  id: "ver-1",
  createdAt: "2026-08-16T10:00:00Z",
  content: content("v1"),
};

function setup(restore?: VersionHistoryProvider["restore"]) {
  const provider: VersionHistoryProvider = {
    list: vi.fn(async () => ({ versions: [VERSION] })),
    get: vi.fn(async () => content("fetched")),
    create: false,
    restore:
      restore ??
      vi.fn(async () => ({ id: "tpl-1", content: content("restored") })),
  };
  const editor = {
    state: { template: { id: "tpl-1" }, isDirty: false },
    content: ref(content("current")),
    setContent: vi.fn((next: TemplateContent) => {
      editor.content.value = next;
    }),
  };
  const history = { clear: vi.fn() };
  const conditionPreview = { reset: vi.fn() };
  const autoSave = { pause: vi.fn(), resume: vi.fn() };
  let finishCatchUp!: () => void;
  const collaboration = {
    suspend: vi.fn(),
    resume: vi.fn(),
    catchUp: vi.fn(
      () => new Promise<void>((resolve) => (finishCatchUp = resolve)),
    ),
    reportReplaceRefused: vi.fn(),
  };
  const scope = effectScope();
  const feature = scope.run(() =>
    useVersionHistoryFeature({
      provider,
      editor: editor as never,
      history: history as never,
      conditionPreview: conditionPreview as never,
      autoSave: autoSave as never,
      collaboration,
    }),
  )!;
  return {
    feature,
    provider,
    editor,
    history,
    conditionPreview,
    autoSave,
    collaboration,
    scope,
    finishCatchUp: () => finishCatchUp(),
  };
}

describe("useVersionHistoryFeature with collaboration", () => {
  it("does nothing more once the editor is gone while a restore catches up", async () => {
    const s = setup();
    await s.feature.navigate(VERSION);
    vi.mocked(s.provider.list).mockClear();

    const restoring = s.feature.confirmRestore();
    await settle();
    expect(s.collaboration.catchUp).toHaveBeenCalledOnce();
    s.scope.stop();
    s.finishCatchUp();
    await restoring;

    expect(s.provider.restore).toHaveBeenCalledWith("tpl-1", "ver-1");
    expect(s.history.clear).not.toHaveBeenCalled();
    expect(s.conditionPreview.reset).not.toHaveBeenCalled();
    expect(s.provider.list).not.toHaveBeenCalled();
    expect(s.collaboration.resume).not.toHaveBeenCalled();
    expect(s.autoSave.resume).not.toHaveBeenCalled();
  });

  it("says a restore was refused, naming no one, when the refusal lists no holders", async () => {
    const refused = Object.assign(
      new Error("Other people are editing blocks."),
      { code: "locked_by_others" },
    );
    const s = setup(
      vi.fn(async () => {
        throw refused;
      }),
    );
    await s.feature.navigate(VERSION);

    await expect(s.feature.confirmRestore()).rejects.toBe(refused);

    expect(s.collaboration.reportReplaceRefused).toHaveBeenCalledWith([]);
    expect(s.editor.setContent).toHaveBeenLastCalledWith(
      content("current"),
      false,
    );
    expect(s.collaboration.resume).toHaveBeenCalledOnce();
    expect(s.feature.isPreviewing.value).toBe(false);
  });

  it("doesn't call a failed restore a lock refusal when the code says otherwise", async () => {
    const failed = Object.assign(new Error("Version not found."), {
      code: "not_found",
      holders: [],
    });
    const s = setup(
      vi.fn(async () => {
        throw failed;
      }),
    );
    await s.feature.navigate(VERSION);

    await expect(s.feature.confirmRestore()).rejects.toBe(failed);

    expect(s.collaboration.reportReplaceRefused).not.toHaveBeenCalled();
    expect(s.collaboration.resume).toHaveBeenCalledOnce();
  });
});
