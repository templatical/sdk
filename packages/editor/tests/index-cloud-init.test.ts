// @vitest-environment happy-dom
//
// Exercises the public SDK entry surface that `index-init.test.ts` and
// `shadow-mount.test.ts` don't: the full `initCloud()` flow (ready
// resolution, timeout rejection, content-access-before-ready), the
// top-level `unmount()` export, and the OSS instance methods
// (getContent/setContent/setTheme/renderCustomBlock/getCustomBlockStylesheet)
// in both their pre-ready (ref null) and post-ready branches.
//
// Vue / Editor.vue / CloudEditor.vue / i18n are mocked the same way as
// shadow-mount.test.ts so we drive just the entry logic, not the editor's
// full bootstrap. A `setup()` render is invoked to capture the props passed
// to `h(...)`, including the `onReady` callback and the template `ref` — we
// then resolve readiness / set the instance ourselves.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Ref } from "vue";

interface Captured {
  props: Record<string, unknown> | null;
}

const captured: Captured = { props: null };
const fakeApps: Array<{ mount: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }> =
  [];

let initFn: typeof import("../src/index").init;
let initCloudFn: typeof import("../src/index").initCloud;
let unmountFn: typeof import("../src/index").unmount;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  captured.props = null;
  fakeApps.length = 0;

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
  vi.doMock("../src/cloud/CloudEditor.vue", () => ({
    default: { name: "CloudEditor" },
  }));
  vi.doMock("../src/i18n", () => ({
    loadTranslations: vi.fn(() => Promise.resolve({})),
    loadCloudTranslations: vi.fn(() => Promise.resolve({})),
  }));
  vi.doMock("../src/composables", () => ({
    useFonts: vi.fn(() => ({ fonts: { value: [] } })),
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

// Cast helper — CloudEditor.vue is mocked, so the config is just passed
// through as a prop and never validated.
function cloudConfig(container: HTMLElement, extra: Record<string, unknown> = {}) {
  return {
    container,
    shadowDom: false,
    content: {},
    ...extra,
  } as unknown as Parameters<typeof initCloudFn>[0];
}

describe("initCloud — readiness", () => {
  it("resolves with an instance once CloudEditor emits ready", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const p = initCloudFn(cloudConfig(container));

    // Wait for createApp/render to run (after the dynamic import + i18n awaits).
    await vi.waitFor(() => expect(captured.props).not.toBeNull());

    expect(typeof captured.props!.onReady).toBe("function");
    (captured.props!.onReady as () => void)();

    const instance = await p;
    expect(typeof instance.save).toBe("function");
    expect(fakeApps[0].mount).toHaveBeenCalledWith(container);
  });

  it("rejects with a timeout error when ready never fires", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);

    const p = initCloudFn(cloudConfig(container));
    p.catch(() => {}); // pre-attach so the rejection isn't unhandled

    // Flush the import/i18n microtasks AND fire the pending 30s timeout.
    await vi.runAllTimersAsync();

    await expect(p).rejects.toThrow(/timed out/i);
  });

  it("throws when the container selector matches nothing", async () => {
    await expect(
      initCloudFn(cloudConfig(document.createElement("div"), {
        container: "#does-not-exist",
      })),
    ).rejects.toThrow(/Container element not found/);
  });
});

describe("initCloud — instance methods", () => {
  async function mountCloud(refValue: Record<string, unknown> | null) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const p = initCloudFn(cloudConfig(container));
    await vi.waitFor(() => expect(captured.props).not.toBeNull());
    if (refValue) {
      (captured.props!.ref as Ref<unknown>).value = refValue;
    }
    (captured.props!.onReady as () => void)();
    const instance = await p;
    return { instance, container };
  }

  it("delegates create/load/save to the mounted CloudEditor instance", async () => {
    const fakeEditor = {
      create: vi.fn(() => Promise.resolve({ id: "t1" })),
      load: vi.fn(() => Promise.resolve({ id: "t2" })),
      save: vi.fn(() => Promise.resolve({ ok: true })),
      getContent: vi.fn(() => ({ blocks: [{ id: "b1" }] })),
      setContent: vi.fn(),
      setTheme: vi.fn(),
    };
    const { instance } = await mountCloud(fakeEditor);

    const created = await instance.create({ blocks: [] } as never);
    expect(created).toEqual({ id: "t1" });
    expect(fakeEditor.create).toHaveBeenCalledWith({ blocks: [] });

    await instance.load("tmpl-99");
    expect(fakeEditor.load).toHaveBeenCalledWith("tmpl-99");

    const saved = await instance.save();
    expect(saved).toEqual({ ok: true });
  });

  it("getContent returns a deep clone of the editor's content (post-ready)", async () => {
    const live = { blocks: [{ id: "b1" }] };
    const fakeEditor = {
      create: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      getContent: vi.fn(() => live),
      setContent: vi.fn(),
      setTheme: vi.fn(),
    };
    const { instance } = await mountCloud(fakeEditor);

    const content = instance.getContent();
    expect(content).toEqual(live);
    // Deep clone — mutating the result must not touch the editor's object.
    (content.blocks as Array<{ id: string }>)[0].id = "mutated";
    expect(live.blocks[0].id).toBe("b1");
  });

  it("setContent and setTheme forward to the editor instance", async () => {
    const fakeEditor = {
      create: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      getContent: vi.fn(() => ({})),
      setContent: vi.fn(),
      setTheme: vi.fn(),
    };
    const { instance } = await mountCloud(fakeEditor);

    const next = { blocks: [{ id: "x" }] } as never;
    instance.setContent(next);
    expect(fakeEditor.setContent).toHaveBeenCalledWith(next);

    instance.setTheme("dark" as never);
    expect(fakeEditor.setTheme).toHaveBeenCalledWith("dark");
  });

  it("rejects create/load/save when the editor ref never populated (not ready)", async () => {
    // ready fires but the template ref stays null (mount produced no instance).
    const { instance } = await mountCloud(null);

    await expect(instance.create()).rejects.toThrow(/not ready/i);
    await expect(instance.load("x")).rejects.toThrow(/not ready/i);
    await expect(instance.save()).rejects.toThrow(/not ready/i);
  });

  it("instance.unmount() tears down the cloud app", async () => {
    const fakeEditor = {
      create: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      getContent: vi.fn(() => ({})),
      setContent: vi.fn(),
      setTheme: vi.fn(),
    };
    const { instance } = await mountCloud(fakeEditor);

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
    expect(instance.getCustomBlockStylesheet("custom-x")).toBe(".cb{color:red}");
  });

  it("toMjml delegates to toMjmlForInstance", async () => {
    const { instance } = await mountOss(null);
    const mjml = await instance.toMjml();
    expect(mjml).toBe("<mjml>mock</mjml>");
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
