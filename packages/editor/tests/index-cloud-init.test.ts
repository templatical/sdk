// @vitest-environment happy-dom
//
// Exercises the public SDK entry surface that `index-init.test.ts` and
// `shadow-mount.test.ts` don't: the `initCloud()` flow, the top-level
// `unmount()` export, and the instance methods
// (getContent/setContent/setTheme/renderCustomBlock/getCustomBlockStylesheet)
// in both their pre-ready (ref null) and post-ready branches.
//
// `initCloud()` is now a wrapper over `init()`: it bootstraps auth + the plan,
// builds Cloud's adapters, and mounts the *same* `Editor.vue`. So there is no
// second component to mock and no `ready` event to resolve — what is asserted
// instead is that Cloud's providers arrive as ordinary `init()` config keys and
// that both entry points return the same instance shape.
//
// Vue / Editor.vue / i18n are mocked the same way as shadow-mount.test.ts so we
// drive just the entry logic, not the editor's full bootstrap. A `setup()`
// render is invoked to capture the props passed to `h(...)`, including the
// template `ref` — we then set the instance ourselves.

import { DEFAULT_AUTO_SAVE_DEBOUNCE_MS } from "@templatical/core";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Ref } from "vue";
import { resolveAutoSave } from "../src/types/auto-save";

interface Captured {
  props: Record<string, unknown> | null;
}

const captured: Captured = { props: null };
const fakeApps: Array<{
  mount: ReturnType<typeof vi.fn>;
  unmount: ReturnType<typeof vi.fn>;
}> = [];

// Stand-ins for what `bootstrapCloud` hands back. The real thing is covered by
// `createCloudRuntime.test.ts`; here we only care that the wrapper forwards it.
const bootstrapCalls: boolean[] = [];
const fakeRuntime = { attach: vi.fn(), ready: vi.fn(), destroy: vi.fn() };
const fakeProviders = {
  templates: { load: vi.fn(), create: vi.fn(), save: vi.fn() },
  render: { toMjml: vi.fn(async () => "<mjml>cloud</mjml>") },
  versionHistory: {
    list: vi.fn(),
    get: vi.fn(),
    create: false,
    restore: false,
  },
  savedBlocks: { list: vi.fn(), create: false, update: false, delete: false },
  testEmail: { send: vi.fn() },
};

let initFn: typeof import("../src/index").init;
let initCloudFn: typeof import("../src/index").initCloud;
let unmountFn: typeof import("../src/index").unmount;

// Builds template content shaped like the #203 repro: a paragraph nested in
// a section column whose data carries a Sortable expando cycle — a fake DOM
// element with a `SortableXXX` instance whose `el` points back to the element.
// A naked JSON.stringify throws `Converting circular structure to JSON` on it.
function makeContentWithSortableCycle(): Record<string, unknown> {
  const sortableInstance: { el: unknown } = { el: null };
  const leakedDiv: Record<string, unknown> = {
    Sortable1781247283888: sortableInstance,
  };
  sortableInstance.el = leakedDiv;
  return {
    blocks: [
      {
        id: "sec",
        type: "section",
        children: [
          [
            {
              id: "para",
              type: "paragraph",
              content: "<p>hi</p>",
              leaked: leakedDiv,
            },
          ],
        ],
      },
    ],
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  captured.props = null;
  fakeApps.length = 0;
  bootstrapCalls.length = 0;

  vi.doMock("vue", async () => {
    const actual = await vi.importActual<typeof import("vue")>("vue");
    return {
      ...actual,
      createApp: vi.fn((options: { setup: () => () => unknown }) => {
        // Run setup() then the render fn so the mocked h captures props.
        options.setup()();
        const app = { mount: vi.fn(), unmount: vi.fn() };
        fakeApps.push(app);
        return app;
      }),
      h: vi.fn((_comp: unknown, props: Record<string, unknown>) => {
        captured.props = props;
        return {};
      }),
    };
  });
  vi.doMock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));
  vi.doMock("../src/cloud/createCloudRuntime", () => ({
    bootstrapCloud: vi.fn(async () => {
      bootstrapCalls.push(true);
      return { runtime: fakeRuntime, providers: fakeProviders };
    }),
  }));
  vi.doMock("../src/i18n", () => ({
    loadTranslations: vi.fn(() => Promise.resolve({})),
    loadCloudTranslations: vi.fn(() => Promise.resolve({})),
  }));
  vi.doMock("../src/composables", () => ({
    // `customFonts` / `defaultFallback` are what `resolveRenderFonts` reads to
    // build the render payload's fonts half.
    useFonts: vi.fn(() => ({
      fonts: { value: [] },
      customFonts: { value: [] },
      defaultFallback: { value: "Arial, sans-serif" },
    })),
  }));
  vi.doMock("../src/utils/toMjml", () => ({
    toMjmlForInstance: vi.fn(() => Promise.resolve("<mjml>mock</mjml>")),
  }));

  const mod = await import("../src/index");
  initFn = mod.init;
  initCloudFn = mod.initCloud;
  unmountFn = mod.unmount;
});

afterEach(() => {
  vi.useRealTimers();
});

// Cast helper — Editor.vue is mocked, so the config is just passed through as
// a prop and never validated.
function cloudConfig(
  container: HTMLElement,
  extra: Record<string, unknown> = {},
) {
  return {
    container,
    shadowDom: false,
    content: {},
    ...extra,
  } as unknown as Parameters<typeof initCloudFn>[0];
}

describe("initCloud — a thin wrapper over init()", () => {
  async function mountCloud(refValue: Record<string, unknown> | null) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const p = initCloudFn(cloudConfig(container));
    await vi.waitFor(() => expect(captured.props).not.toBeNull());
    if (refValue) {
      (captured.props!.ref as Ref<unknown>).value = refValue;
    }
    return { instance: await p, container };
  }

  it("bootstraps Cloud before mounting anything", async () => {
    const { container } = await mountCloud(null);

    expect(bootstrapCalls.length).toBe(1);
    expect(fakeApps[0].mount).toHaveBeenCalledWith(container);
  });

  it("mounts the same Editor.vue, with Cloud's runtime alongside the config", async () => {
    await mountCloud(null);

    // The proof the collapse worked: one editor component, and the cloud half
    // arrives as a prop rather than as a second component.
    expect(captured.props!.cloud).toBe(fakeRuntime);
    expect(captured.props!.onReady).toBeUndefined();
  });

  it("passes Cloud's adapters through the ordinary init() config keys", async () => {
    await mountCloud(null);
    const config = captured.props!.config as Record<string, unknown>;
    const templates = config.templates as Record<string, unknown>;

    // `templates` is a new merged object (config keys are layered onto it), so
    // the storage methods are asserted individually rather than by reference
    // to `fakeProviders.templates` as a whole.
    expect(templates.load).toBe(fakeProviders.templates.load);
    expect(templates.create).toBe(fakeProviders.templates.create);
    expect(templates.save).toBe(fakeProviders.templates.save);
    expect(config.render).toBe(fakeProviders.render);
    expect(config.versionHistory).toBe(fakeProviders.versionHistory);
    expect(config.savedBlocks).toBe(fakeProviders.savedBlocks);
    expect(config.testEmail).toBe(fakeProviders.testEmail);
  });

  it("defaults autosave on, at the shared default cadence", async () => {
    // Autosave and its cadence are two separate keys: `templates.autoSave`
    // (Cloud differs from `init()` here — on unless refused, since Cloud
    // always has a store) and `changeDebounce` (Cloud does NOT differ here —
    // both entry points land on `DEFAULT_AUTO_SAVE_DEBOUNCE_MS`, the one
    // constant both read; made explicit for Cloud so a consumer's own
    // `changeDebounce` reaches it through this same config).
    await mountCloud(null);
    const config = captured.props!.config as Record<string, unknown>;

    expect((config.templates as Record<string, unknown>).autoSave).toBe(true);
    expect(config.changeDebounce).toBe(DEFAULT_AUTO_SAVE_DEBOUNCE_MS);
  });

  it("honours an explicit templates.autoSave: false", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const p = initCloudFn(
      cloudConfig(container, { templates: { autoSave: false } }),
    );
    await vi.waitFor(() => expect(captured.props).not.toBeNull());
    await p;

    const config = captured.props!.config as Record<string, unknown>;
    expect((config.templates as Record<string, unknown>).autoSave).toBe(false);
  });

  it("honours an explicit changeDebounce", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const p = initCloudFn(cloudConfig(container, { changeDebounce: 250 }));
    await vi.waitFor(() => expect(captured.props).not.toBeNull());
    await p;

    expect(
      (captured.props!.config as Record<string, unknown>).changeDebounce,
    ).toBe(250);
  });

  it("forwards the unsaved-changes keys init() owns", async () => {
    // `unsavedChangesGuard` sits on `templates`, alongside `autoSave` and
    // `nameField`; `onDirtyChange` stays at the config root. Both keys reach
    // Cloud's mounted config the same way `init()`'s do.
    const onDirtyChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const p = initCloudFn(
      cloudConfig(container, {
        onDirtyChange,
        templates: { unsavedChangesGuard: false },
      }),
    );
    await vi.waitFor(() => expect(captured.props).not.toBeNull());
    await p;

    const config = captured.props!.config as Record<string, unknown>;
    expect(config.onDirtyChange).toBe(onDirtyChange);
    expect(
      (config.templates as Record<string, unknown>).unsavedChangesGuard,
    ).toBe(false);
  });

  it("throws when the container selector matches nothing", async () => {
    await expect(
      initCloudFn(
        cloudConfig(document.createElement("div"), {
          container: "#does-not-exist",
        }),
      ),
    ).rejects.toThrow(/Container element not found/);
  });

  it("rejects when the bootstrap fails, rather than mounting a dead editor", async () => {
    const { bootstrapCloud } = await import("../src/cloud/createCloudRuntime");
    vi.mocked(bootstrapCloud).mockRejectedValueOnce(
      new Error("Health check failed: API is not reachable"),
    );
    const container = document.createElement("div");
    document.body.appendChild(container);

    await expect(initCloudFn(cloudConfig(container))).rejects.toThrow(
      /API is not reachable/,
    );
    expect(fakeApps.length).toBe(0);
  });

  it("returns the same instance shape init() does", async () => {
    // `TemplaticalCloudEditor` *is* `TemplaticalEditor` — the convergence is the
    // proof, so a divergent member would be a regression rather than a feature.
    const fakeEditor = {
      getContent: vi.fn(() => ({ blocks: [] })),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
      create: vi.fn(async () => ({ id: "t1", content: {} })),
      load: vi.fn(async () => ({ id: "t2", content: {} })),
      save: vi.fn(async () => ({ id: "t3", content: {} })),
      isDirty: vi.fn(() => false),
    };
    const { instance } = await mountCloud(fakeEditor);

    expect(Object.keys(instance).sort()).toEqual([
      "create",
      "getContent",
      "getCustomBlockStylesheet",
      "isDirty",
      "load",
      "renderCustomBlock",
      "save",
      "setContent",
      "setTheme",
      "toHtml",
      "toMjml",
      "unmount",
    ]);
  });

  it("resolves toMjml through the render provider the bootstrap supplied", async () => {
    const fakeEditor = {
      getContent: vi.fn(() => ({ blocks: [] })),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    };
    const { instance } = await mountCloud(fakeEditor);

    await expect(instance.toMjml()).resolves.toBe("<mjml>cloud</mjml>");
  });

  it("takes init()'s create(input) shape, not a bare TemplateContent", async () => {
    const fakeEditor = {
      getContent: vi.fn(() => ({})),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
      create: vi.fn(async () => ({ id: "t1", content: {} })),
      load: vi.fn(),
      save: vi.fn(),
      isDirty: vi.fn(() => false),
    };
    const { instance } = await mountCloud(fakeEditor);

    await instance.create({ name: "Fresh" });
    expect(fakeEditor.create).toHaveBeenCalledWith({ name: "Fresh" });
  });

  it("unmounts through the one editor registry", async () => {
    const { instance } = await mountCloud({
      getContent: vi.fn(() => ({})),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    });

    instance.unmount();
    expect(fakeApps[0].unmount).toHaveBeenCalledTimes(1);
  });
});

describe("OSS init — instance methods", () => {
  async function mountOss(refValue: Record<string, unknown> | null) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const content = { blocks: [{ id: "seed" }] };
    const instance = await initFn({
      container,
      shadowDom: false,
      content,
    } as unknown as Parameters<typeof initFn>[0]);
    if (refValue) {
      (captured.props!.ref as Ref<unknown>).value = refValue;
    }
    return { instance, container, content };
  }

  it("pre-ready: getContent clones config.content, setContent updates config, accessors are safe", async () => {
    const { instance, content } = await mountOss(null);

    const got = instance.getContent();
    expect(got).toEqual(content);
    expect(got).not.toBe(content); // deep-cloned

    // setContent before ready stores onto config (no editor ref yet).
    const next = { blocks: [{ id: "later" }] } as never;
    instance.setContent(next);
    expect(instance.getContent()).toEqual(next);

    // setTheme is a silent no-op pre-ready (no throw, nothing to assert but state).
    instance.setTheme("dark" as never);

    expect(instance.getCustomBlockStylesheet("custom-x")).toBeUndefined();
    await expect(instance.renderCustomBlock({} as never)).rejects.toThrow(
      /not ready/i,
    );
  });

  it("post-ready: methods delegate to the editor instance", async () => {
    const fakeEditor = {
      getContent: vi.fn(() => ({ blocks: [{ id: "live" }] })),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(() => Promise.resolve("<div>cb</div>")),
      getCustomBlockStylesheet: vi.fn(() => ".cb{color:red}"),
    };
    const { instance } = await mountOss(fakeEditor);

    expect(instance.getContent()).toEqual({ blocks: [{ id: "live" }] });

    instance.setContent({ blocks: [] } as never);
    expect(fakeEditor.setContent).toHaveBeenCalledWith({ blocks: [] });

    instance.setTheme("light" as never);
    expect(fakeEditor.setTheme).toHaveBeenCalledWith("light");

    const html = await instance.renderCustomBlock({ id: "cb1" } as never);
    expect(html).toBe("<div>cb</div>");
    expect(instance.getCustomBlockStylesheet("custom-x")).toBe(
      ".cb{color:red}",
    );
  });

  it("post-ready: getContent survives a Sortable expando cycle in live content (issue #203)", async () => {
    // Repro of #203: dragging a block within a section leaks a Sortable
    // expando back-ref (HTMLDivElement.SortableXXX → instance → el → div)
    // into the editor's live content. The public getContent() must
    // serialize without throwing `Converting circular structure to JSON`.
    const live = makeContentWithSortableCycle();
    const fakeEditor = {
      getContent: vi.fn(() => live),
      setContent: vi.fn(),
      setTheme: vi.fn(),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    };
    const { instance } = await mountOss(fakeEditor);

    let content!: ReturnType<typeof instance.getContent>;
    expect(() => {
      content = instance.getContent();
    }).not.toThrow();
    // Block data is preserved; only the cyclic DOM back-ref is dropped.
    const para = (content as any).blocks[0].children[0][0];
    expect(para.content).toBe("<p>hi</p>");
    expect(para.leaked.Sortable1781247283888).toEqual({});
  });

  it("toMjml delegates to toMjmlForInstance", async () => {
    const { instance } = await mountOss(null);
    const mjml = await instance.toMjml();
    expect(mjml).toBe("<mjml>mock</mjml>");
  });

  describe("render provider", () => {
    async function mountWithRender(render: Record<string, unknown>) {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const instance = await initFn({
        container,
        shadowDom: false,
        content: { blocks: [] },
        render,
      } as unknown as Parameters<typeof initFn>[0]);
      (captured.props!.ref as Ref<unknown>).value = {
        getContent: vi.fn(() => ({ blocks: [] })),
        setContent: vi.fn(),
        setTheme: vi.fn(),
        renderCustomBlock: vi.fn(),
        getCustomBlockStylesheet: vi.fn(),
      };
      return instance;
    }

    it("prefers render.toMjml over the bundled renderer", async () => {
      const toMjml = vi.fn(() => Promise.resolve("<mjml>provider</mjml>"));
      const instance = await mountWithRender({ toMjml });

      await expect(instance.toMjml()).resolves.toBe("<mjml>provider</mjml>");
      expect(toMjml).toHaveBeenCalledTimes(1);
    });

    it("compiles the locally-rendered MJML through render.compileMjml", async () => {
      const compileMjml = vi.fn((mjml: string) =>
        Promise.resolve(`<html>${mjml}</html>`),
      );
      const instance = await mountWithRender({ compileMjml });

      // `toMjmlForInstance` is mocked to "<mjml>mock</mjml>", so this also proves
      // toHtml() reached the bundled renderer rather than inventing its own MJML.
      await expect(instance.toHtml()).resolves.toBe(
        "<html><mjml>mock</mjml></html>",
      );
    });

    it("rejects toHtml with no render provider — there is no local HTML path", async () => {
      const { instance } = await mountOss(null);
      await expect(instance.toHtml()).rejects.toThrow(
        /no local HTML path|toHtml\(\) requires a `render` provider/,
      );
    });
  });

  describe("templates lifecycle", () => {
    it("delegates create/load/save/isDirty to the mounted editor", async () => {
      const fakeEditor = {
        getContent: vi.fn(() => ({})),
        setContent: vi.fn(),
        setTheme: vi.fn(),
        renderCustomBlock: vi.fn(),
        getCustomBlockStylesheet: vi.fn(),
        create: vi.fn(() => Promise.resolve({ id: "t1", content: {} })),
        load: vi.fn(() => Promise.resolve({ id: "t2", content: {} })),
        save: vi.fn(() => Promise.resolve({ id: "t3", content: {} })),
        isDirty: vi.fn(() => true),
      };
      const { instance } = await mountOss(fakeEditor);

      await expect(instance.create({ name: "Fresh" })).resolves.toEqual({
        id: "t1",
        content: {},
      });
      expect(fakeEditor.create).toHaveBeenCalledWith({ name: "Fresh" });

      await expect(instance.load("t2")).resolves.toEqual({
        id: "t2",
        content: {},
      });
      expect(fakeEditor.load).toHaveBeenCalledWith("t2");

      await expect(instance.save()).resolves.toEqual({
        id: "t3",
        content: {},
      });
      expect(instance.isDirty()).toBe(true);
    });

    it("rejects create/load/save before the editor mounts", async () => {
      const { instance } = await mountOss(null);

      await expect(instance.create()).rejects.toThrow(/not ready/i);
      await expect(instance.load("x")).rejects.toThrow(/not ready/i);
      await expect(instance.save()).rejects.toThrow(/not ready/i);
    });

    it("reports nothing unsaved before the editor mounts", async () => {
      // Nothing has been edited yet, so "no unsaved changes" is the honest
      // answer — a throw would make a router guard fail on first navigation.
      const { instance } = await mountOss(null);

      expect(instance.isDirty()).toBe(false);
    });
  });
});

describe("top-level unmount()", () => {
  it("tears down the most-recently-created OSS editor and is idempotent", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await initFn({
      container,
      shadowDom: false,
      content: {},
    } as unknown as Parameters<typeof initFn>[0]);

    expect(fakeApps[0].unmount).not.toHaveBeenCalled();

    unmountFn();
    expect(fakeApps[0].unmount).toHaveBeenCalledTimes(1);

    // Second call: nothing tracked → no-op (must not throw or double-unmount).
    unmountFn();
    expect(fakeApps[0].unmount).toHaveBeenCalledTimes(1);
  });
});

describe("templates-scoped config on Cloud", () => {
  it("resolveAutoSave falls back to defaultEnabled only when value is undefined", () => {
    // A direct unit test of the helper's `??` semantics, not of `initCloud()`
    // — `initCloud()` inlines `config.templates?.autoSave ?? true` in
    // `index.ts` rather than calling this function, and the package's one
    // real call site is `Editor.vue`'s, which always passes `false`.
    // "Defaults autosave on" and "lets the provider object turn it off" are
    // covered behaviourally above, through a real `initCloud()` call.
    expect(resolveAutoSave(undefined, true)).toBe(true);
    expect(resolveAutoSave(false, true)).toBe(false);
    expect(resolveAutoSave(true, false)).toBe(true);
  });
});
