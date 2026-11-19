// @vitest-environment happy-dom
// Public init() instance methods before and after Editor.vue becomes ready.
// Mock Vue rendering to capture the editor ref and exercise the entry surface.

import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
} from "@templatical/types";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

let initFn: typeof import("../src/index").init;
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

  vi.doMock("vue", async () => {
    const actual = await vi.importActual<typeof import("vue")>("vue");
    return {
      ...actual,
      createApp: vi.fn((options: { setup: () => () => unknown }) => {
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
  vi.doMock("../src/i18n", () => ({
    loadTranslations: vi.fn(() => Promise.resolve({})),
  }));
  vi.doMock("../src/composables", () => ({
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
  unmountFn = mod.unmount;
});

afterEach(() => {
  vi.useRealTimers();
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

    // With no editor behind the instance there is nothing to insert into.
    expect(instance.insertBlock(createParagraphBlock())).toBeNull();
    // A slot is rejected even here, as setContent would reject it.
    expect(() => instance.insertBlock(createSlotBlock())).toThrow(/slot/);
    expect(instance.getContent()).toEqual(next);
  });

  it("post-ready: insertBlock converts bare merge tags before handing the block over", async () => {
    const fakeEditor = {
      getContent: vi.fn(() => createDefaultTemplateContent()),
      insertBlock: vi.fn(() => "inserted-id"),
    };
    const { instance } = await mountOss(fakeEditor);
    const block = createParagraphBlock({
      content: "<p>Hi {{first_name}}</p>",
    });

    expect(instance.insertBlock(block)).toBe("inserted-id");

    const handed = fakeEditor.insertBlock.mock.calls[0][0] as {
      id: string;
      content: string;
    };
    expect(handed.id).toBe(block.id);
    expect(handed.content).toContain('data-merge-tag="{{first_name}}"');
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

  it("forwards config.socialIconsBaseUrl to the local render", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const instance = await initFn({
      container,
      shadowDom: false,
      content: { blocks: [] },
      socialIconsBaseUrl: "https://cdn.example.com/social",
    } as unknown as Parameters<typeof initFn>[0]);
    (captured.props!.ref as Ref<unknown>).value = {
      getContent: vi.fn(() => ({ blocks: [] })),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    };

    await instance.toMjml();

    const { toMjmlForInstance } = await import("../src/utils/toMjml");
    expect(vi.mocked(toMjmlForInstance)).toHaveBeenLastCalledWith(
      expect.objectContaining({
        socialIconsBaseUrl: "https://cdn.example.com/social",
      }),
    );
  });

  it("omits socialIconsBaseUrl from the local render when unset", async () => {
    const { instance } = await mountOss({
      getContent: vi.fn(() => ({ blocks: [] })),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    });

    const { toMjmlForInstance } = await import("../src/utils/toMjml");
    vi.mocked(toMjmlForInstance).mockClear();
    await instance.toMjml();

    const source = vi.mocked(toMjmlForInstance).mock.calls.at(-1)![0];
    expect(source.socialIconsBaseUrl).toBeUndefined();
  });

  it("forwards config.layout into the local toMjml path", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const layout = createDefaultTemplateContent();
    layout.blocks = [createSlotBlock()];
    layout.settings = { ...layout.settings, backgroundColor: "#f3f4f6" };
    const instance = await initFn({
      container,
      shadowDom: false,
      content: { blocks: [] },
      layout,
    } as unknown as Parameters<typeof initFn>[0]);
    (captured.props!.ref as Ref<unknown>).value = {
      getContent: vi.fn(() => ({ blocks: [] })),
      renderCustomBlock: vi.fn(),
      getCustomBlockStylesheet: vi.fn(),
    };

    await instance.toMjml();

    const { toMjmlForInstance } = await import("../src/utils/toMjml");
    const source = vi.mocked(toMjmlForInstance).mock.calls.at(-1)![0];
    // A copy: the layout enters through the same normalization as content,
    // which never hands the editor the caller's own object.
    expect(source.getLayout?.()).toEqual(layout);
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

    // The test-email dialog's `includeMjml` payload must come off the same
    // resolution ladder as `editor.toMjml()`. Rendering it locally instead would
    // mean testing a message the send pipeline never produces.
    it("hands the test-email feature the resolved MJML path, not the bundled renderer", async () => {
      const toMjml = vi.fn(() => Promise.resolve("<mjml>provider</mjml>"));
      await mountWithRender({ toMjml });

      const renderMjml = captured.props!.renderMjml as () => Promise<string>;
      await expect(renderMjml()).resolves.toBe("<mjml>provider</mjml>");

      const usesLocalRenderer = captured.props!
        .usesLocalRenderer as () => boolean;
      expect(usesLocalRenderer()).toBe(false);
    });

    it("reports the bundled renderer as the MJML path when the provider omits toMjml", async () => {
      await mountWithRender({ compileMjml: vi.fn() });

      const usesLocalRenderer = captured.props!
        .usesLocalRenderer as () => boolean;
      expect(usesLocalRenderer()).toBe(true);
    });

    // The behavioural test above still passes if someone reintroduces a local
    // render inside Editor.vue as a *fallback* (`props.renderMjml ?? local`),
    // which is the shape the bug had. Owning no render path at all is what makes
    // the divergence unreachable rather than merely unused.
    it("leaves Editor.vue with no MJML path of its own", () => {
      const source = readFileSync(
        join(import.meta.dirname, "..", "src", "Editor.vue"),
        "utf8",
      );

      expect(source).not.toContain("toMjmlForInstance");
      expect(source).toContain("props.renderMjml");
    });

    it("rejects toHtml with no render provider — there is no local HTML path", async () => {
      const { instance } = await mountOss(null);
      await expect(instance.toHtml()).rejects.toThrow(
        /no local HTML path|toHtml\(\) requires a `render` provider/,
      );
    });
  });

  describe("content entry points hand the editor a copy", () => {
    // The editor edits the object it holds in place. Holding the caller's own
    // object leaks every edit into it, and one another Vue made reactive, or
    // froze, would hide edits from the editor's own Vue or throw on them.
    function fakeEditorWith(extra: Record<string, unknown> = {}) {
      return {
        getContent: vi.fn(() => ({})),
        setContent: vi.fn(),
        setTheme: vi.fn(),
        renderCustomBlock: vi.fn(),
        getCustomBlockStylesheet: vi.fn(),
        ...extra,
      };
    }

    it("init() mounts the editor on a copy of `content`", async () => {
      const { content } = await mountOss(null);

      const config = captured.props!.config as { content: unknown };
      expect(config.content).toEqual(content);
      expect(config.content).not.toBe(content);
    });

    // `init()` mounts on a copy of the config itself, so the prepared
    // `layout` and `content` never land on the caller's object,
    // which may be frozen.
    it("init() leaves the caller's config untouched", async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const content = { blocks: [{ id: "seed" }] };
      const layout = { blocks: [createSlotBlock()], settings: {} };
      const config = { container, shadowDom: false, content, layout };

      await initFn(config as unknown as Parameters<typeof initFn>[0]);

      expect(config.content).toBe(content);
      expect(config.layout).toBe(layout);
      const mounted = captured.props!.config as Record<string, unknown>;
      expect(mounted.content).toEqual(content);
      expect(mounted.layout).toEqual(layout);
    });

    it("init() mounts with a frozen config", async () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const content = { blocks: [{ id: "seed" }] };
      const layout = { blocks: [createSlotBlock()], settings: {} };

      await initFn(
        Object.freeze({
          container,
          shadowDom: false,
          content,
          layout,
        }) as unknown as Parameters<typeof initFn>[0],
      );

      expect(fakeApps[0].mount).toHaveBeenCalledWith(container);
      const mounted = captured.props!.config as Record<string, unknown>;
      expect(mounted.content).toEqual(content);
      expect(mounted.layout).toEqual(layout);
    });

    it("setContent() hands the mounted editor a copy", async () => {
      const fakeEditor = fakeEditorWith();
      const { instance } = await mountOss(fakeEditor);
      const next = { blocks: [{ id: "next" }] } as never;

      instance.setContent(next);

      const handed = fakeEditor.setContent.mock.calls[0][0];
      expect(handed).toEqual(next);
      expect(handed).not.toBe(next);
    });

    it("create({ content }) hands the mounted editor a copy", async () => {
      const fakeEditor = fakeEditorWith({
        create: vi.fn(() => Promise.resolve({ id: "t1", content: {} })),
      });
      const { instance } = await mountOss(fakeEditor);
      const content = { blocks: [{ id: "fresh" }] } as never;

      await instance.create({ name: "Fresh", content });

      const handed = (fakeEditor.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { name: string; content: unknown };
      expect(handed.name).toBe("Fresh");
      expect(handed.content).toEqual(content);
      expect(handed.content).not.toBe(content);
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
    });

    expect(fakeApps[0].unmount).not.toHaveBeenCalled();

    unmountFn();
    expect(fakeApps[0].unmount).toHaveBeenCalledTimes(1);

    // Second call: nothing tracked → no-op (must not throw or double-unmount).
    unmountFn();
    expect(fakeApps[0].unmount).toHaveBeenCalledTimes(1);
  });
});

describe("resolveAutoSave", () => {
  it("resolveAutoSave falls back to defaultEnabled only when value is undefined", () => {
    // The helper uses `??`: only an undefined value selects the default.
    expect(resolveAutoSave(undefined, true)).toBe(true);
    expect(resolveAutoSave(false, true)).toBe(false);
    expect(resolveAutoSave(true, false)).toBe(true);
  });
});
