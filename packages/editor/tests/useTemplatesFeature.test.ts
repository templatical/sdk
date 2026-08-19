// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h, reactive, ref } from "vue";
import { mount } from "@vue/test-utils";
import type {
  Template,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import {
  useTemplatesFeature,
  type UseTemplatesFeatureReturn,
} from "../src/composables/useTemplatesFeature";

const CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;

function createProvider(
  overrides: Partial<TemplatesProvider> = {},
): TemplatesProvider {
  return {
    load: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
}

/**
 * Stand-in for core's `useEditor`, so the feature is tested against the slice it
 * actually consumes rather than a whole editor. Its `save`/`create`/`load` are
 * spies, so status handling can be driven without a provider round-trip.
 */
function createEditor(
  options: {
    template?: {
      id: string;
      name?: string;
      createdAt?: string;
      updatedAt?: string;
    } | null;
    save?: () => Promise<Template>;
    create?: () => Promise<Template>;
    load?: () => Promise<Template>;
  } = {},
) {
  const state = reactive({
    template: options.template ?? null,
    isDirty: false,
    isSaving: false,
  });
  const stored: Template = { id: "tpl_1", name: "Welcome", content: CONTENT };

  return {
    state,
    setName: vi.fn((name: string) => {
      if (!state.template) return;
      state.template = { ...state.template, name };
      state.isDirty = true;
    }),
    create: vi.fn(options.create ?? (() => Promise.resolve(stored))),
    load: vi.fn(options.load ?? (() => Promise.resolve(stored))),
    save: vi.fn(options.save ?? (() => Promise.resolve(stored))),
    hasTemplate: () => state.template !== null,
  };
}

type MockEditor = ReturnType<typeof createEditor>;

/**
 * Mounted features are torn down between tests. The guard registers a
 * `beforeunload` listener on the shared `window`, so a leaked instance with a
 * dirty editor of its own would answer for the test that comes next.
 */
const mounted: { unmount: () => void }[] = [];

function withFeature(options: {
  provider?: TemplatesProvider;
  editor?: MockEditor;
  guardUnsavedChanges?: boolean;
  isAvailable?: () => boolean;
}) {
  const provider = options.provider ?? createProvider();
  const editor = options.editor ?? createEditor({ template: { id: "tpl_1" } });
  let feature!: UseTemplatesFeatureReturn;

  const wrapper = mount(
    defineComponent({
      setup() {
        feature = useTemplatesFeature({
          provider,
          editor,
          guardUnsavedChanges: options.guardUnsavedChanges,
          isAvailable: options.isAvailable,
        });
        return () => h("div");
      },
    }),
  );

  mounted.push(wrapper);
  return { feature, provider, editor, wrapper };
}

describe("useTemplatesFeature", () => {
  afterEach(() => {
    while (mounted.length > 0) mounted.pop()!.unmount();
  });

  describe("the stored write time", () => {
    const UPDATED = "2026-08-19T11:00:00.000Z";
    const CREATED = "2026-08-01T09:30:00.000Z";

    it("prefers updatedAt and says so", () => {
      const { feature } = withFeature({
        editor: createEditor({
          template: { id: "tpl_1", createdAt: CREATED, updatedAt: UPDATED },
        }),
      });

      expect(feature.timestamp.value).toEqual({
        iso: UPDATED,
        kind: "updatedAt",
      });
    });

    it("falls back to createdAt, and carries that it did", () => {
      // A store that records creation but never modification. The header must
      // not call this "Updated" — it is a claim the store never made.
      const { feature } = withFeature({
        editor: createEditor({ template: { id: "tpl_1", createdAt: CREATED } }),
      });

      expect(feature.timestamp.value).toEqual({
        iso: CREATED,
        kind: "createdAt",
      });
    });

    it("is null when the provider supplies neither", () => {
      const { feature } = withFeature({
        editor: createEditor({ template: { id: "tpl_1", name: "Welcome" } }),
      });

      expect(feature.timestamp.value).toBe(null);
    });

    it("is null before a template is loaded", () => {
      const { feature } = withFeature({
        editor: createEditor({ template: null }),
      });

      expect(feature.timestamp.value).toBe(null);
    });

    it("follows the template the store hands back", () => {
      // `save()` resolves with the stored record, and core replaces
      // `state.template` with it — so a fresh write time has to land in the
      // header without anything re-reading the provider.
      const editor = createEditor({
        template: { id: "tpl_1", updatedAt: CREATED },
      });
      const { feature } = withFeature({ editor });
      expect(feature.timestamp.value?.iso).toBe(CREATED);

      editor.state.template = { id: "tpl_1", updatedAt: UPDATED };

      expect(feature.timestamp.value?.iso).toBe(UPDATED);
    });

    it("is on the capability, so the header reads it without prop drilling", () => {
      const { feature } = withFeature({
        editor: createEditor({ template: { id: "tpl_1", updatedAt: UPDATED } }),
      });

      expect(feature.capability.timestamp.value).toEqual({
        iso: UPDATED,
        kind: "updatedAt",
      });
    });
  });

  describe("capability flags", () => {
    it("reports both mutations as available for a full provider", () => {
      const { feature } = withFeature({});

      expect(feature.canCreate.value).toBe(true);
      expect(feature.canSave.value).toBe(true);
      expect(feature.isAvailable.value).toBe(true);
    });

    it("reports create as unavailable when the provider passed false", () => {
      const { feature } = withFeature({
        provider: createProvider({ create: false }),
      });

      expect(feature.canCreate.value).toBe(false);
      expect(feature.canSave.value).toBe(true);
    });

    it("reports save as unavailable when the provider passed false", () => {
      const { feature } = withFeature({
        provider: createProvider({ save: false }),
      });

      expect(feature.canSave.value).toBe(false);
      expect(feature.canCreate.value).toBe(true);
    });

    it("tracks an external availability gate that flips after setup", () => {
      // Read reactively, not snapshotted: a future adapter resolves its
      // entitlement after capabilities are already provided.
      const allowed = ref(false);
      const { feature } = withFeature({ isAvailable: () => allowed.value });

      expect(feature.isAvailable.value).toBe(false);
      allowed.value = true;
      expect(feature.isAvailable.value).toBe(true);
    });

    it("mirrors the editor's template identity and saving flag", () => {
      const editor = createEditor({ template: { id: "tpl_1", name: "Draft" } });
      const { feature } = withFeature({ editor });

      expect(feature.name.value).toBe("Draft");
      expect(feature.hasTemplate.value).toBe(true);
      expect(feature.isSaving.value).toBe(false);

      editor.state.isSaving = true;
      expect(feature.isSaving.value).toBe(true);
    });

    it("reports no template before create() or load() resolves", () => {
      const { feature } = withFeature({
        editor: createEditor({ template: null }),
      });

      expect(feature.hasTemplate.value).toBe(false);
      expect(feature.name.value).toBeUndefined();
    });

    it("exposes the same members on its capability object", () => {
      const { feature } = withFeature({});

      expect(feature.capability.canSave).toBe(feature.canSave);
      expect(feature.capability.canCreate).toBe(feature.canCreate);
      expect(feature.capability.isAvailable).toBe(feature.isAvailable);
      expect(feature.capability.status).toBe(feature.status);
      expect(feature.capability.name).toBe(feature.name);
      expect(feature.capability.save).toBe(feature.requestSave);
      expect(feature.capability.rename).toBe(feature.rename);
    });
  });

  describe("save status", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows saved after a successful save, then decays to idle", async () => {
      const { feature } = withFeature({});

      await feature.save();
      expect(feature.status.value).toBe("saved");
      expect(feature.errorMessage.value).toBe("");

      vi.advanceTimersByTime(2999);
      expect(feature.status.value).toBe("saved");
      vi.advanceTimersByTime(1);
      expect(feature.status.value).toBe("idle");
    });

    it("restarts the decay window on a second save", async () => {
      const { feature } = withFeature({});

      await feature.save();
      vi.advanceTimersByTime(2000);
      await feature.save();

      vi.advanceTimersByTime(2000);
      expect(feature.status.value).toBe("saved");
      vi.advanceTimersByTime(1000);
      expect(feature.status.value).toBe("idle");
    });

    it("shows the provider's message on failure and re-throws", async () => {
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () => Promise.reject(new Error("Storage is full")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.save()).rejects.toThrow("Storage is full");
      expect(feature.status.value).toBe("error");
      expect(feature.errorMessage.value).toBe("Storage is full");
    });

    it("keeps the error visible rather than decaying it", async () => {
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () => Promise.reject(new Error("nope")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.save()).rejects.toThrow();
      vi.advanceTimersByTime(10_000);

      expect(feature.status.value).toBe("error");
    });

    it("falls back to a generic message for a message-less rejection", async () => {
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () => Promise.reject(new Error("")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.save()).rejects.toThrow();
      expect(feature.errorMessage.value).toBe("Save failed");
    });

    it("clears a previous error once a save succeeds", async () => {
      let fail = true;
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () =>
          fail
            ? Promise.reject(new Error("first attempt"))
            : Promise.resolve({ id: "tpl_1", content: CONTENT }),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.save()).rejects.toThrow();
      fail = false;
      await feature.save();

      expect(feature.status.value).toBe("saved");
      expect(feature.errorMessage.value).toBe("");
    });

    it("reports create through the same status, and re-throws", async () => {
      const editor = createEditor({
        template: null,
        create: () => Promise.reject(new Error("create refused")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.create()).rejects.toThrow("create refused");
      expect(feature.status.value).toBe("error");
      expect(feature.errorMessage.value).toBe("create refused");
    });

    it("stays idle after a successful create", async () => {
      // The badge acknowledges a save the user asked for. Attaching a template is
      // not one, and `load()` attaches silently — so a create that flashed green
      // made the same action look different depending on which path reached it.
      const { feature } = withFeature({
        editor: createEditor({ template: null }),
      });

      await feature.create({ name: "Fresh" });

      expect(feature.status.value).toBe("idle");
    });

    it("a create that succeeds clears a failure left by an earlier one", async () => {
      // Removing the success report must not let "Save failed" outlive the
      // success that followed it.
      let attempt = 0;
      const { feature } = withFeature({
        editor: createEditor({
          template: null,
          create: () => {
            attempt += 1;
            return attempt === 1
              ? Promise.reject(new Error("boom"))
              : Promise.resolve({ id: "tpl_1", name: "Fresh" });
          },
        }),
      });

      await expect(feature.create({ name: "Fresh" })).rejects.toThrow("boom");
      expect(feature.status.value).toBe("error");
      expect(feature.errorMessage.value).toBe("boom");

      await feature.create({ name: "Fresh" });

      expect(feature.status.value).toBe("idle");
      expect(feature.errorMessage.value).toBe("");
    });

    it("a load clears the badge left by the previous template", async () => {
      // The green badge decays after 3s. Loading inside that window would carry
      // it onto content that was never saved.
      const editor = createEditor({ template: { id: "tpl_1" } });
      const { feature } = withFeature({ editor });

      await feature.save();
      expect(feature.status.value).toBe("saved");

      await feature.load("tpl_2");

      expect(feature.status.value).toBe("idle");
    });

    it("a load clears a failure from the template being left behind", async () => {
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () => Promise.reject(new Error("boom")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.save()).rejects.toThrow("boom");
      expect(feature.status.value).toBe("error");

      await feature.load("tpl_2");

      expect(feature.status.value).toBe("idle");
      expect(feature.errorMessage.value).toBe("");
    });

    it("leaves the status alone when a load fails", async () => {
      // A failed load is not a failed save, and "Save failed" would be a lie.
      const editor = createEditor({
        template: { id: "tpl_1" },
        load: () => Promise.reject(new Error("404")),
      });
      const { feature } = withFeature({ editor });

      await expect(feature.load("missing")).rejects.toThrow("404");
      expect(feature.status.value).toBe("idle");
      expect(feature.errorMessage.value).toBe("");
    });

    it("passes the load straight through to the editor", async () => {
      const { feature, editor } = withFeature({});

      const template = await feature.load("tpl_9");

      expect(editor.load).toHaveBeenCalledWith("tpl_9");
      expect(template.id).toBe("tpl_1");
    });
  });

  describe("requestSave", () => {
    it("saves and swallows the rejection, leaving it in the status", async () => {
      const editor = createEditor({
        template: { id: "tpl_1" },
        save: () => Promise.reject(new Error("offline")),
      });
      const { feature } = withFeature({ editor });

      expect(() => feature.requestSave()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();

      expect(editor.save).toHaveBeenCalledTimes(1);
      expect(feature.status.value).toBe("error");
    });

    it("does nothing when the provider withheld save", () => {
      const { feature, editor } = withFeature({
        provider: createProvider({ save: false }),
      });

      feature.requestSave();

      expect(editor.save).not.toHaveBeenCalled();
      expect(feature.status.value).toBe("idle");
    });

    it("does nothing before a template exists", () => {
      const editor = createEditor({ template: null });
      const { feature } = withFeature({ editor });

      feature.requestSave();

      expect(editor.save).not.toHaveBeenCalled();
    });

    it("does nothing while a save is already running", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      editor.state.isSaving = true;
      const { feature } = withFeature({ editor });

      feature.requestSave();

      expect(editor.save).not.toHaveBeenCalled();
    });
  });

  describe("requestAutoSave", () => {
    /**
     * The tick is dropped while a save is in flight — correct, since two PATCHes
     * of the whole document must never overlap. But nothing reschedules it:
     * `useAutoSave`'s timer has already fired and cleared itself, and only a
     * further content mutation arms a new one. So autosave went silent until the
     * user typed again. Driven by an explicit deferred rather than timers — with
     * fake timers the save resolves before the second tick and the race never
     * happens.
     */
    it("re-arms after an in-flight save instead of dropping the tick", async () => {
      const stored: Template = { id: "tpl_1", name: "Welcome", content: CONTENT };
      const editor = createEditor({ template: { id: "tpl_1" } });
      editor.state.isDirty = true;

      let release!: () => void;
      editor.save = vi.fn(() => {
        editor.state.isSaving = true;
        return new Promise<Template>((resolve) => {
          release = () => {
            editor.state.isSaving = false;
            resolve(stored);
          };
        });
      });

      const { feature } = withFeature({ editor });

      feature.requestAutoSave();
      expect(editor.save).toHaveBeenCalledTimes(1);

      // Lands mid-flight. Must not run concurrently...
      feature.requestAutoSave();
      expect(editor.save).toHaveBeenCalledTimes(1);

      // ...but must not be lost either.
      release();
      await vi.waitFor(() => expect(editor.save).toHaveBeenCalledTimes(2));
    });

    it("does not re-arm when the in-flight save left nothing dirty", async () => {
      const stored: Template = { id: "tpl_1", name: "Welcome", content: CONTENT };
      const editor = createEditor({ template: { id: "tpl_1" } });
      editor.state.isDirty = true;

      let release!: () => void;
      editor.save = vi.fn(() => {
        editor.state.isSaving = true;
        return new Promise<Template>((resolve) => {
          release = () => {
            editor.state.isSaving = false;
            editor.state.isDirty = false; // the save covered everything
            resolve(stored);
          };
        });
      });

      const { feature } = withFeature({ editor });

      feature.requestAutoSave();
      feature.requestAutoSave();
      release();
      await Promise.resolve();
      await Promise.resolve();

      expect(editor.save).toHaveBeenCalledTimes(1);
    });
  });

  describe("rename", () => {
    it("sets the name and persists it", async () => {
      const editor = createEditor({ template: { id: "tpl_1", name: "Old" } });
      const { feature } = withFeature({ editor });

      feature.rename("New");
      await Promise.resolve();

      expect(editor.setName).toHaveBeenCalledWith("New");
      expect(editor.save).toHaveBeenCalledTimes(1);
      expect(feature.name.value).toBe("New");
    });

    it("trims surrounding whitespace before committing", () => {
      const editor = createEditor({ template: { id: "tpl_1", name: "Old" } });
      const { feature } = withFeature({ editor });

      feature.rename("  Padded  ");

      expect(editor.setName).toHaveBeenCalledWith("Padded");
    });

    it("ignores an empty or whitespace-only name", () => {
      const editor = createEditor({ template: { id: "tpl_1", name: "Old" } });
      const { feature } = withFeature({ editor });

      feature.rename("");
      feature.rename("   ");

      expect(editor.setName).not.toHaveBeenCalled();
      expect(editor.save).not.toHaveBeenCalled();
      expect(feature.name.value).toBe("Old");
    });

    it("ignores a commit that changes nothing", () => {
      const editor = createEditor({ template: { id: "tpl_1", name: "Same" } });
      const { feature } = withFeature({ editor });

      feature.rename("Same");

      expect(editor.setName).not.toHaveBeenCalled();
      expect(editor.save).not.toHaveBeenCalled();
    });

    it("names a template that had none", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      const { feature } = withFeature({ editor });

      feature.rename("First");

      expect(editor.setName).toHaveBeenCalledWith("First");
    });
  });

  describe("unsaved-changes guard", () => {
    /**
     * Asserted through a `preventDefault` spy rather than `defaultPrevented`,
     * which happy-dom reports as true for a freshly constructed cancelable event
     * — so it can't tell "the guard fired" from "nothing listened".
     */
    function dispatchBeforeUnload() {
      const event = new Event("beforeunload", {
        cancelable: true,
      }) as BeforeUnloadEvent;
      const preventDefault = vi.spyOn(event, "preventDefault");
      window.dispatchEvent(event);
      return { event, preventDefault };
    }

    it("prompts on beforeunload while dirty", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      withFeature({ editor });
      editor.state.isDirty = true;

      const { event, preventDefault } = dispatchBeforeUnload();

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(event.returnValue).toBe("");
    });

    it("stays silent when there is nothing unsaved", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      withFeature({ editor });

      const { preventDefault } = dispatchBeforeUnload();

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it("is not registered at all when opted out", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      withFeature({ editor, guardUnsavedChanges: false });
      editor.state.isDirty = true;

      const { preventDefault } = dispatchBeforeUnload();

      expect(preventDefault).not.toHaveBeenCalled();
    });

    it("stops prompting once the editor unmounts", () => {
      const editor = createEditor({ template: { id: "tpl_1" } });
      const { wrapper } = withFeature({ editor });
      editor.state.isDirty = true;
      wrapper.unmount();

      const { preventDefault } = dispatchBeforeUnload();

      expect(preventDefault).not.toHaveBeenCalled();
    });
  });
});
