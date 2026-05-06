import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";
import type { TemplateSnapshot, TemplateContent } from "@templatical/types";

vi.mock("@templatical/core/cloud", () => ({
  useSnapshotHistory: vi.fn(),
}));

import { useSnapshotHistory } from "@templatical/core/cloud";
import { useSnapshotPreview } from "../src/cloud/composables/useSnapshotPreview";

function createMockEditor() {
  return {
    state: {
      template: { id: "tpl-1" },
      isDirty: false,
      content: { blocks: [], settings: {} },
    },
    content: ref<TemplateContent>({
      blocks: [],
      settings: {},
    } as TemplateContent),
    setContent: vi.fn(),
    hasTemplate: vi.fn(() => true),
    createSnapshot: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockHistory() {
  return { clear: vi.fn() };
}

function createMockConditionPreview() {
  return { reset: vi.fn() };
}

function createMockAutoSave() {
  return { pause: vi.fn(), resume: vi.fn() };
}

function createMockSnapshotHistoryReturn() {
  return {
    snapshots: ref<TemplateSnapshot[]>([]),
    isLoading: ref(false),
    isRestoring: ref(false),
    loadSnapshots: vi.fn().mockResolvedValue(undefined),
    restoreSnapshot: vi
      .fn()
      .mockResolvedValue({ content: { blocks: [], settings: {} } }),
  };
}

function createSnapshot(id: string): TemplateSnapshot {
  return {
    id,
    content: {
      blocks: [{ id: "b1", type: "paragraph" }],
      settings: {},
    },
    created_at: "2026-01-01",
  } as any;
}

function createOptions(overrides: Record<string, any> = {}) {
  return {
    authManager: {} as any,
    editor: createMockEditor(),
    history: createMockHistory() as any,
    conditionPreview: createMockConditionPreview() as any,
    autoSave: createMockAutoSave() as any,
    onError: vi.fn(),
    ...overrides,
  };
}

describe("useSnapshotPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // structuredClone cannot clone Vue reactive refs, so stub with JSON round-trip.
    // Must re-stub per test: global afterEach calls vi.unstubAllGlobals().
    vi.stubGlobal(
      "structuredClone",
      (val: unknown) => JSON.parse(JSON.stringify(val)),
    );
  });

  describe("initial state", () => {
    it("isPreviewingSnapshot is false", () => {
      const result = useSnapshotPreview(createOptions());
      expect(result.isPreviewingSnapshot.value).toBe(false);
    });

    it("snapshotHistorySnapshots is empty", () => {
      const result = useSnapshotPreview(createOptions());
      expect(result.snapshotHistorySnapshots.value).toEqual([]);
    });

    it("snapshotHistoryIsLoading is false", () => {
      const result = useSnapshotPreview(createOptions());
      expect(result.snapshotHistoryIsLoading.value).toBe(false);
    });

    it("snapshotHistoryIsRestoring is false", () => {
      const result = useSnapshotPreview(createOptions());
      expect(result.snapshotHistoryIsRestoring.value).toBe(false);
    });
  });

  describe("initSnapshotHistory", () => {
    it("creates instance when template has id", () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.initSnapshotHistory();

      expect(useSnapshotHistory).toHaveBeenCalledWith({
        authManager: options.authManager,
        templateId: "tpl-1",
        onRestore: expect.any(Function),
        onError: options.onError,
      });
      expect(mockReturn.loadSnapshots).toHaveBeenCalledTimes(1);
      expect(result.snapshotHistoryInstance.value).toBe(mockReturn);
    });

    it("no-op when no template id", () => {
      const editor = createMockEditor();
      (editor.state as any).template = null;
      const result = useSnapshotPreview(createOptions({ editor }));

      result.initSnapshotHistory();

      expect(useSnapshotHistory).not.toHaveBeenCalled();
      expect(result.snapshotHistoryInstance.value).toBe(null);
    });

    it("no-op when instance already exists", () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const result = useSnapshotPreview(createOptions());

      result.initSnapshotHistory();
      result.initSnapshotHistory();

      expect(useSnapshotHistory).toHaveBeenCalledTimes(1);
      expect(mockReturn.loadSnapshots).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleRestore", () => {
    it("sets content, clears history, and resets condition preview", () => {
      const options = createOptions();
      const result = useSnapshotPreview(options);

      const content: TemplateContent = {
        blocks: [{ id: "restored", type: "paragraph" }],
        settings: {},
      } as any;

      result.handleRestore({ content });

      expect(options.editor.setContent).toHaveBeenCalledWith(content, false);
      expect(options.history.clear).toHaveBeenCalledTimes(1);
      expect(options.conditionPreview.reset).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleSnapshotNavigate", () => {
    it("first navigate saves content, pauses autoSave, sets snapshot", async () => {
      const options = createOptions();
      options.editor.content.value = {
        blocks: [{ id: "original" }],
        settings: {},
      } as any;

      const result = useSnapshotPreview(options);
      const snapshot = createSnapshot("snap-1");

      await result.handleSnapshotNavigate(snapshot);

      expect(result.contentBeforePreview.value).toEqual({
        blocks: [{ id: "original" }],
        settings: {},
      });
      expect(options.autoSave.pause).toHaveBeenCalledTimes(1);
      expect(result.previewingSnapshot.value).toStrictEqual(snapshot);
      expect(options.editor.setContent).toHaveBeenCalledWith(
        snapshot.content,
        false,
      );
      expect(result.isPreviewingSnapshot.value).toBe(true);
    });

    it("creates snapshot if dirty and has template", async () => {
      const options = createOptions();
      options.editor.state.isDirty = true;
      options.editor.hasTemplate.mockReturnValue(true);

      const result = useSnapshotPreview(options);
      const snapshot = createSnapshot("snap-1");

      await result.handleSnapshotNavigate(snapshot);

      expect(options.editor.createSnapshot).toHaveBeenCalledTimes(1);
    });

    it("skips snapshot creation if not dirty", async () => {
      const options = createOptions();
      options.editor.state.isDirty = false;

      const result = useSnapshotPreview(options);
      const snapshot = createSnapshot("snap-1");

      await result.handleSnapshotNavigate(snapshot);

      expect(options.editor.createSnapshot).not.toHaveBeenCalled();
    });

    it("skips snapshot creation if no template", async () => {
      const options = createOptions();
      options.editor.state.isDirty = true;
      options.editor.hasTemplate.mockReturnValue(false);

      const result = useSnapshotPreview(options);
      const snapshot = createSnapshot("snap-1");

      await result.handleSnapshotNavigate(snapshot);

      expect(options.editor.createSnapshot).not.toHaveBeenCalled();
    });

    it("does not mutate state if scope is disposed before createSnapshot resolves", async () => {
      const { effectScope } = await import("vue");
      const options = createOptions();
      options.editor.state.isDirty = true;
      options.editor.hasTemplate.mockReturnValue(true);

      // createSnapshot resolves only when we want it to.
      let resolveCreateSnapshot!: () => void;
      options.editor.createSnapshot = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveCreateSnapshot = resolve;
          }),
      );

      const scope = effectScope();
      let result!: ReturnType<typeof useSnapshotPreview>;
      scope.run(() => {
        result = useSnapshotPreview(options);
      });

      const snapshot = createSnapshot("snap-1");
      const navigatePromise = result.handleSnapshotNavigate(snapshot);

      // Simulate the component unmounting BEFORE the snapshot creation completes.
      scope.stop();

      // Now the awaited promise resolves. Per CLAUDE.md, post-unmount state
      // mutations must be guarded — autoSave.pause / setContent / state writes
      // should NOT fire after the scope is gone.
      resolveCreateSnapshot();
      await navigatePromise;

      expect(options.autoSave.pause).not.toHaveBeenCalled();
      expect(options.editor.setContent).not.toHaveBeenCalled();
      expect(result.previewingSnapshot.value).toBe(null);
      expect(result.contentBeforePreview.value).toBe(null);
    });

    it("subsequent navigate while previewing swaps snapshot without saving content again", async () => {
      const options = createOptions();
      options.editor.content.value = {
        blocks: [{ id: "original" }],
        settings: {},
      } as any;

      const result = useSnapshotPreview(options);
      const snapshot1 = createSnapshot("snap-1");
      const snapshot2 = createSnapshot("snap-2");

      await result.handleSnapshotNavigate(snapshot1);

      const savedContent = result.contentBeforePreview.value;
      options.editor.setContent.mockClear();
      options.autoSave.pause.mockClear();

      await result.handleSnapshotNavigate(snapshot2);

      expect(result.previewingSnapshot.value).toStrictEqual(snapshot2);
      expect(options.editor.setContent).toHaveBeenCalledWith(
        snapshot2.content,
        false,
      );
      expect(options.editor.setContent).toHaveBeenCalledTimes(1);
      expect(options.autoSave.pause).not.toHaveBeenCalled();
      expect(result.contentBeforePreview.value).toEqual(savedContent);
    });
  });

  describe("confirmRestoreSnapshot", () => {
    it("restores and reloads snapshots, clears state, resumes autoSave", async () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.initSnapshotHistory();

      const snapshot = createSnapshot("snap-1");
      await result.handleSnapshotNavigate(snapshot);

      mockReturn.loadSnapshots.mockClear();

      await result.confirmRestoreSnapshot();

      expect(mockReturn.restoreSnapshot).toHaveBeenCalledWith("snap-1");
      expect(mockReturn.loadSnapshots).toHaveBeenCalledTimes(1);
      expect(result.previewingSnapshot.value).toBe(null);
      expect(result.contentBeforePreview.value).toBe(null);
      expect(options.autoSave.resume).toHaveBeenCalledTimes(1);
      expect(result.isPreviewingSnapshot.value).toBe(false);
    });

    it("no-op when not previewing", async () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.initSnapshotHistory();

      await result.confirmRestoreSnapshot();

      expect(mockReturn.restoreSnapshot).not.toHaveBeenCalled();
      expect(options.autoSave.resume).not.toHaveBeenCalled();
    });

    it("resumes autoSave in finally even on error", async () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      mockReturn.restoreSnapshot.mockRejectedValue(new Error("API failure"));
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.initSnapshotHistory();

      const snapshot = createSnapshot("snap-1");
      await result.handleSnapshotNavigate(snapshot);

      await expect(result.confirmRestoreSnapshot()).rejects.toThrow(
        "API failure",
      );

      expect(result.previewingSnapshot.value).toBe(null);
      expect(result.contentBeforePreview.value).toBe(null);
      expect(options.autoSave.resume).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelPreview", () => {
    it("restores original content and clears state", async () => {
      const options = createOptions();
      options.editor.content.value = {
        blocks: [{ id: "original" }],
        settings: {},
      } as any;

      const result = useSnapshotPreview(options);
      const snapshot = createSnapshot("snap-1");

      await result.handleSnapshotNavigate(snapshot);
      options.editor.setContent.mockClear();

      result.cancelPreview();

      expect(options.editor.setContent).toHaveBeenCalledWith(
        { blocks: [{ id: "original" }], settings: {} },
        false,
      );
      expect(result.previewingSnapshot.value).toBe(null);
      expect(result.contentBeforePreview.value).toBe(null);
      expect(options.autoSave.resume).toHaveBeenCalledTimes(1);
      expect(result.isPreviewingSnapshot.value).toBe(false);
    });

    it("no-op when not previewing", () => {
      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.cancelPreview();

      expect(options.editor.setContent).not.toHaveBeenCalled();
      expect(options.autoSave.resume).not.toHaveBeenCalled();
    });
  });

  describe("loadSnapshotHistory", () => {
    it("delegates to instance loadSnapshots", async () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const options = createOptions();
      const result = useSnapshotPreview(options);

      result.initSnapshotHistory();
      mockReturn.loadSnapshots.mockClear();

      await result.loadSnapshotHistory();

      expect(mockReturn.loadSnapshots).toHaveBeenCalledTimes(1);
    });

    it("no-op when no instance exists", async () => {
      const result = useSnapshotPreview(createOptions());

      await result.loadSnapshotHistory();

      expect(useSnapshotHistory).not.toHaveBeenCalled();
    });
  });

  describe("computed properties delegate to instance", () => {
    it("snapshotHistorySnapshots reflects instance snapshots", () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      const snap = createSnapshot("snap-x");
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const result = useSnapshotPreview(createOptions());

      expect(result.snapshotHistorySnapshots.value).toEqual([]);

      result.initSnapshotHistory();
      mockReturn.snapshots.value = [snap];

      expect(result.snapshotHistorySnapshots.value).toHaveLength(1);
      expect(result.snapshotHistorySnapshots.value[0].id).toBe("snap-x");
    });

    it("snapshotHistoryIsLoading reflects instance isLoading", () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const result = useSnapshotPreview(createOptions());
      result.initSnapshotHistory();

      expect(result.snapshotHistoryIsLoading.value).toBe(false);

      mockReturn.isLoading.value = true;
      expect(result.snapshotHistoryIsLoading.value).toBe(true);
    });

    it("snapshotHistoryIsRestoring reflects instance isRestoring", () => {
      const mockReturn = createMockSnapshotHistoryReturn();
      vi.mocked(useSnapshotHistory).mockReturnValue(mockReturn as any);

      const result = useSnapshotPreview(createOptions());
      result.initSnapshotHistory();

      expect(result.snapshotHistoryIsRestoring.value).toBe(false);

      mockReturn.isRestoring.value = true;
      expect(result.snapshotHistoryIsRestoring.value).toBe(true);
    });
  });
});
