// @vitest-environment happy-dom
//
// `instance.unmount()` tears down that instance and nothing else.
//
// The hazard is React StrictMode. It runs an effect twice, and a bundler that
// settles both `init()` dynamic imports in one microtask drain (webpack's shared
// in-flight chunk promise) mounts instance #2 *before* the cancelled first
// effect's `ed.unmount()` runs. A container-scoped teardown then removes
// instance #2 and leaves a blank editor.
//
// Unlike the other entry tests this one mounts through real Vue, so every
// assertion reads the DOM a consumer would see. Only `Editor.vue` is a stub: a
// component that renders a labelled root and exposes a `getContent()` whose
// answer differs from the `config.content` the entry falls back to once the
// editor is gone, so "still mounted" is observable two independent ways.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateContent } from "@templatical/types";

const STUB_ROOT = "[data-testid='stub-editor']";

/** Content an `init()` is seeded with; the stub reads its label back out. */
function contentFor(label: string): TemplateContent {
  return {
    blocks: [{ id: label, type: "paragraph", content: `<p>${label}</p>` }],
    settings: {},
  } as unknown as TemplateContent;
}

/** The first block's id: `label` when seeded, `live:label` when the editor answers. */
function firstBlockId(content: TemplateContent): string {
  return content.blocks[0].id;
}

/**
 * Labels of every editor root the container currently shows. Shadow mode renders
 * inside the container's open shadow root; light mode renders into the container.
 */
function editorLabels(container: HTMLElement): string[] {
  const root: ParentNode = container.shadowRoot ?? container;
  return Array.from(
    root.querySelectorAll(STUB_ROOT),
    (el) => el.getAttribute("data-label") ?? "",
  );
}

function newContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

let init: typeof import("../src/index").init;
let initCloud: typeof import("../src/index").initCloud;
let unmount: typeof import("../src/index").unmount;

// Everything a test mounts, so a failing test cannot leak an editor (and its
// dev style mirror's observer on `document.head`) into the next one.
const mounted: Array<{ unmount(): void }> = [];

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  vi.doMock("../src/Editor.vue", async () => {
    const { defineComponent, h } = await import("vue");
    return {
      default: defineComponent({
        name: "StubEditor",
        // The entry hands `Editor.vue` a dozen props; only `config` matters
        // here, and none of them may fall through onto the root as attributes.
        inheritAttrs: false,
        props: { config: { type: Object, required: true } },
        setup(props, { expose }) {
          const seed = props.config.content as TemplateContent;
          const label = firstBlockId(seed);
          expose({ getContent: () => contentFor(`live:${label}`) });
          return () =>
            h("div", { "data-testid": "stub-editor", "data-label": label });
        },
      }),
    };
  });
  vi.doMock("../src/cloud/createCloudRuntime", () => ({
    bootstrapCloud: vi.fn(async () => ({ runtime: {}, providers: {} })),
  }));
  vi.doMock("../src/i18n", () => ({
    loadTranslations: vi.fn(() => Promise.resolve({})),
    loadCloudTranslations: vi.fn(() => Promise.resolve({})),
  }));
  vi.doMock("../src/composables", () => ({
    useFonts: vi.fn(() => ({
      fonts: { value: [] },
      customFonts: { value: [] },
      defaultFallback: { value: "Arial, sans-serif" },
    })),
  }));
  vi.doMock("../src/utils/toMjml", () => ({
    toMjmlForInstance: vi.fn(() => Promise.resolve("<mjml/>")),
  }));

  const mod = await import("../src/index");
  init = mod.init;
  initCloud = mod.initCloud;
  unmount = mod.unmount;
});

afterEach(() => {
  for (const editor of mounted.splice(0)) {
    editor.unmount();
  }
  document.body.innerHTML = "";
});

describe.each([
  { mode: "shadow DOM", shadowDom: true },
  { mode: "light DOM", shadowDom: false },
])("instance.unmount() — $mode", ({ shadowDom }) => {
  async function mount(container: HTMLElement, label: string) {
    const editor = await init({
      container,
      shadowDom,
      content: contentFor(label),
    });
    mounted.push(editor);
    return editor;
  }

  it("leaves the replacement mounted when a superseded instance unmounts, and unmounts it on its own call", async () => {
    const container = newContainer();

    const a = await mount(container, "a");
    expect(editorLabels(container)).toEqual(["a"]);

    const b = await mount(container, "b");
    // `init()` still replaces whatever the container held, unconditionally.
    expect(editorLabels(container)).toEqual(["b"]);

    a.unmount();

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");

    b.unmount();

    expect(editorLabels(container)).toEqual([]);
  });

  // The reported failure, step for step: effect #1 starts `init()`, its cleanup
  // flips `cancelled`, effect #2 starts `init()` again, and one shared in-flight
  // chunk promise settles both mounts in the same drain. Effect #1's `init()`
  // resolves after effect #2 has already mounted, then calls `ed.unmount()`.
  it("survives a cancelled first mount whose init() settles after the second one mounted", async () => {
    const { loadTranslations } = await import("../src/i18n");
    let settle!: (translations: Record<string, unknown>) => void;
    const sharedChunk = new Promise<Record<string, unknown>>((resolve) => {
      settle = resolve;
    });
    vi.mocked(loadTranslations).mockReturnValue(sharedChunk as never);

    const container = newContainer();
    let cancelled = false;
    const firstEffect = (async () => {
      const ed = await init({
        container,
        shadowDom,
        content: contentFor("a"),
      });
      if (cancelled) {
        ed.unmount();
      }
      return ed;
    })();
    cancelled = true;
    const secondEffect = init({
      container,
      shadowDom,
      content: contentFor("b"),
    });

    settle({});
    const [a, b] = await Promise.all([firstEffect, secondEffect]);
    mounted.push(a, b);

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });

  it("leaves the other instance mounted when the first-resolved of two concurrent init() calls unmounts", async () => {
    const container = newContainer();
    const settled: Array<{ unmount(): void }> = [];
    const settleOrder = async (pending: ReturnType<typeof init>) => {
      const ed = await pending;
      settled.push(ed);
      return ed;
    };

    const [a, b] = await Promise.all([
      settleOrder(init({ container, shadowDom, content: contentFor("a") })),
      settleOrder(init({ container, shadowDom, content: contentFor("b") })),
    ]);
    mounted.push(a, b);
    // Not assumed: the instance that unmounts below is the one that resolved first.
    expect(settled[0]).toBe(a);
    expect(settled[1]).toBe(b);
    expect(editorLabels(container)).toEqual(["b"]);

    settled[0].unmount();

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });

  it("applies to initCloud() instances, which are the same editor", async () => {
    const container = newContainer();
    const cloudConfig = (label: string) =>
      ({
        container,
        shadowDom,
        content: contentFor(label),
      }) as unknown as Parameters<typeof initCloud>[0];

    const a = await initCloud(cloudConfig("a"));
    const b = await initCloud(cloudConfig("b"));
    mounted.push(a, b);
    expect(editorLabels(container)).toEqual(["b"]);

    a.unmount();

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });

  it("is inert on a handle that already unmounted, even after a later init() on its container", async () => {
    const container = newContainer();

    const first = await mount(container, "first");
    first.unmount();
    expect(editorLabels(container)).toEqual([]);

    const second = await mount(container, "second");
    expect(editorLabels(container)).toEqual(["second"]);

    first.unmount();

    expect(editorLabels(container)).toEqual(["second"]);
    expect(firstBlockId(second.getContent())).toBe("live:second");
  });

  it("is a no-op the second time and never touches another container's editor", async () => {
    const left = newContainer();
    const right = newContainer();
    const leftEditor = await mount(left, "left");
    const rightEditor = await mount(right, "right");

    leftEditor.unmount();
    expect(editorLabels(left)).toEqual([]);
    expect(editorLabels(right)).toEqual(["right"]);

    leftEditor.unmount();

    expect(editorLabels(left)).toEqual([]);
    expect(editorLabels(right)).toEqual(["right"]);
    expect(firstBlockId(rightEditor.getContent())).toBe("live:right");

    rightEditor.unmount();

    expect(editorLabels(right)).toEqual([]);
  });
});

// Shadow mode only: a light-DOM mount has no style mirror. In dev the live
// editor's mirror observes `document.head`, so a stale handle's no-op must leave
// the registered entry's `cleanup()` alone — otherwise dev styles stop flowing
// into an editor that is still on screen.
describe("instance.unmount() — dev style mirror", () => {
  it("keeps the replacement's mirror syncing document styles after a stale handle unmounts", async () => {
    const container = newContainer();
    const a = await init({
      container,
      shadowDom: true,
      content: contentFor("a"),
    });
    const b = await init({
      container,
      shadowDom: true,
      content: contentFor("b"),
    });
    mounted.push(a, b);

    a.unmount();

    const adoptedBefore = container.shadowRoot!.adoptedStyleSheets.length;
    const lateStyle = document.createElement("style");
    lateStyle.textContent = ".late-dev-style{color:red}";
    document.head.appendChild(lateStyle);
    try {
      await vi.waitFor(() =>
        expect(container.shadowRoot!.adoptedStyleSheets.length).toBe(
          adoptedBefore + 1,
        ),
      );
    } finally {
      lateStyle.remove();
    }
  });
});

describe("the top-level unmount() export", () => {
  it("tears down the most recently mounted editor and leaves other containers alone", async () => {
    const older = newContainer();
    const newer = newContainer();
    mounted.push(
      await init({ container: older, content: contentFor("older") }),
      await init({ container: newer, content: contentFor("newer") }),
    );
    expect(editorLabels(older)).toEqual(["older"]);
    expect(editorLabels(newer)).toEqual(["newer"]);

    unmount();

    expect(editorLabels(newer)).toEqual([]);
    expect(editorLabels(older)).toEqual(["older"]);
  });

  it("still tears down the replacement after a superseded handle's own unmount did nothing", async () => {
    const container = newContainer();
    const a = await init({ container, content: contentFor("a") });
    const b = await init({ container, content: contentFor("b") });
    mounted.push(a, b);

    a.unmount();
    expect(editorLabels(container)).toEqual(["b"]);

    unmount();

    expect(editorLabels(container)).toEqual([]);
  });
});
