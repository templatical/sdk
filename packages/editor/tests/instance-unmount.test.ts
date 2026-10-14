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
import {
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  type TemplateContent,
} from "@templatical/types";

const STUB_ROOT = "[data-testid='stub-editor']";

/** Content an `init()` is seeded with; the stub reads its label back out. */
function contentFor(label: string): TemplateContent {
  return {
    blocks: [{ id: label, type: "paragraph", content: `<p>${label}</p>` }],
    settings: {},
  } as unknown as TemplateContent;
}

/** A layout shell with no slot, which `validateLayout` refuses. */
function layoutWithoutSlot(): TemplateContent {
  return {
    blocks: [createParagraphBlock({ content: "<p>Header</p>" })],
    settings: {},
  } as TemplateContent;
}

/** One input per check the entry runs on `layout` and `content`, with its error. */
const ILLEGAL_SEEDS = [
  {
    name: "a layout with no slot",
    seed: () => ({ layout: layoutWithoutSlot() }),
    error: "[Templatical] layout: must contain exactly one slot block",
  },
  {
    name: "content holding a slot",
    seed: () => ({
      content: { blocks: [createSlotBlock()], settings: {} } as TemplateContent,
    }),
    error: "[Templatical] slot is not a valid content block",
  },
  {
    name: "content holding a wrapper",
    seed: () => ({
      content: {
        blocks: [createWrapperBlock()],
        settings: {},
      } as TemplateContent,
    }),
    error: "[Templatical] wrapper is not a valid content block",
  },
];

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

/** A promise the test settles by hand, so two calls finish in a chosen order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
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

// Two calls on one container can settle in either order: on a cold load under
// React StrictMode's dev double effect, the cancelled first `init()` can settle
// last. The order calls were *made* in decides which editor the container
// keeps, never the order they settle in.
describe.each([
  { mode: "shadow DOM", shadowDom: true },
  { mode: "light DOM", shadowDom: false },
])("concurrent init() on one container — $mode", ({ shadowDom }) => {
  /** Holds each `init()`'s translations until the test settles them. */
  async function holdTranslations() {
    const { loadTranslations } = await import("../src/i18n");
    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    vi.mocked(loadTranslations)
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);
    return { first, second };
  }

  // The reported failure, step for step: effect #1 starts `init()`, its
  // cleanup flips `cancelled`, effect #2 starts `init()` again, and effect #1's
  // call settles after effect #2's editor mounted, then calls `ed.unmount()`.
  it("keeps the later call's editor when a cancelled earlier call settles after it mounted", async () => {
    const { first, second } = await holdTranslations();
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

    second.resolve({});
    const b = await secondEffect;
    mounted.push(b);
    expect(editorLabels(container)).toEqual(["b"]);

    first.resolve({});
    mounted.push(await firstEffect);

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });

  it("never mounts an earlier call that settles after a later one mounted, and leaves its handle inert", async () => {
    const { first, second } = await holdTranslations();
    const container = newContainer();

    const pendingA = init({ container, shadowDom, content: contentFor("a") });
    const pendingB = init({ container, shadowDom, content: contentFor("b") });

    second.resolve({});
    const b = await pendingB;
    mounted.push(b);
    first.resolve({});
    const a = await pendingA;
    mounted.push(a);

    expect(editorLabels(container)).toEqual(["b"]);
    // `a` never mounted, so it answers from its seed rather than a live editor.
    expect(firstBlockId(a.getContent())).toBe("a");

    a.unmount();

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });

  // A superseded call that settles first neither mounts nor tears down the
  // editor the container already shows; the latest call replaces it once it
  // settles.
  it("leaves the container's current editor alone when a superseded call settles before the latest one", async () => {
    const container = newContainer();
    mounted.push(
      await init({ container, shadowDom, content: contentFor("current") }),
    );
    const { first, second } = await holdTranslations();

    const pendingA = init({ container, shadowDom, content: contentFor("a") });
    const pendingB = init({ container, shadowDom, content: contentFor("b") });

    first.resolve({});
    const a = await pendingA;
    mounted.push(a);

    expect(editorLabels(container)).toEqual(["current"]);
    expect(firstBlockId(a.getContent())).toBe("a");

    second.resolve({});
    mounted.push(await pendingB);

    expect(editorLabels(container)).toEqual(["b"]);
  });

  // `initCloud()` waits on the network before it mounts, so its calls settle in
  // whatever order their bootstraps answer. The race is the one above, with a
  // wider window.
  it("keeps the later initCloud() editor when a cancelled earlier call's bootstrap settles after it mounted", async () => {
    const { bootstrapCloud } = await import("../src/cloud/createCloudRuntime");
    type Bootstrap = Awaited<ReturnType<typeof bootstrapCloud>>;
    const first = deferred<Bootstrap>();
    const second = deferred<Bootstrap>();
    vi.mocked(bootstrapCloud)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const bootstrap = { runtime: {}, providers: {} } as unknown as Bootstrap;

    const container = newContainer();
    const cloudConfig = (label: string) =>
      ({
        container,
        shadowDom,
        content: contentFor(label),
      }) as unknown as Parameters<typeof initCloud>[0];

    let cancelled = false;
    const firstEffect = (async () => {
      const ed = await initCloud(cloudConfig("a"));
      if (cancelled) {
        ed.unmount();
      }
      return ed;
    })();
    cancelled = true;
    // Vitest hands the real module to the second of two `import()`s of a
    // mocked module made in one tick, and each `initCloud()` imports
    // `createCloudRuntime`. So the second call starts once the first is waiting
    // on its bootstrap, which is still before that bootstrap settles.
    await vi.waitFor(() => expect(bootstrapCloud).toHaveBeenCalledTimes(1));
    const secondEffect = initCloud(cloudConfig("b"));

    second.resolve(bootstrap);
    const b = await secondEffect;
    mounted.push(b);
    expect(editorLabels(container)).toEqual(["b"]);

    first.resolve(bootstrap);
    mounted.push(await firstEffect);

    expect(editorLabels(container)).toEqual(["b"]);
    expect(firstBlockId(b.getContent())).toBe("live:b");
  });
});

// `init()` and `initCloud()` check `layout` and `content` when they are called,
// before they claim the container. A call that fails a check rejects at once:
// it supersedes no earlier call, and the container and the editor it shows stay
// exactly as they were.
describe.each([
  { mode: "shadow DOM", shadowDom: true },
  { mode: "light DOM", shadowDom: false },
])("an illegal layout or content — $mode", ({ shadowDom }) => {
  it.each(ILLEGAL_SEEDS)(
    "init() with $name rejects and leaves the container's editor mounted",
    async ({ seed, error }) => {
      const container = newContainer();
      const a = await init({ container, shadowDom, content: contentFor("a") });
      mounted.push(a);

      await expect(
        init({ container, shadowDom, content: contentFor("b"), ...seed() }),
      ).rejects.toThrow(error);

      expect(editorLabels(container)).toEqual(["a"]);
      expect(firstBlockId(a.getContent())).toBe("live:a");
    },
  );

  it.each([
    {
      entry: "init()",
      call: (config: Parameters<typeof init>[0]) => init(config),
    },
    {
      entry: "initCloud()",
      call: (config: Parameters<typeof init>[0]) =>
        initCloud(config as unknown as Parameters<typeof initCloud>[0]),
    },
  ])(
    "$entry with an illegal layout does not supersede an earlier call still loading",
    async ({ call }) => {
      // Only the valid call's translations are held. If the illegal call ever
      // reaches its own again, they still settle, so the test fails, not hangs.
      const { loadTranslations } = await import("../src/i18n");
      const loading = deferred<Record<string, unknown>>();
      vi.mocked(loadTranslations).mockReturnValueOnce(loading.promise as never);
      const container = newContainer();

      const pending = init({ container, shadowDom, content: contentFor("a") });
      await expect(
        call({
          container,
          shadowDom,
          content: contentFor("b"),
          layout: layoutWithoutSlot(),
        }),
      ).rejects.toThrow(
        "[Templatical] layout: must contain exactly one slot block",
      );

      loading.resolve({});
      const a = await pending;
      mounted.push(a);

      expect(editorLabels(container)).toEqual(["a"]);
      expect(firstBlockId(a.getContent())).toBe("live:a");
    },
  );
});

// Shadow mode only: a light-DOM mount writes nothing to the container before
// Vue mounts. `attachShadow()` can't be undone, so a call that is going to
// reject must not reach it.
describe("an illegal layout or content — fresh container", () => {
  it.each(ILLEGAL_SEEDS)(
    "init() with $name rejects without attaching a shadow root",
    async ({ seed, error }) => {
      const container = newContainer();

      await expect(
        init({
          container,
          shadowDom: true,
          content: contentFor("a"),
          ...seed(),
        }),
      ).rejects.toThrow(error);

      expect(container.shadowRoot).toBeNull();
    },
  );
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
