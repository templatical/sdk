import "./dom-stubs";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

// Mock heavy/component dependencies before importing the entry.
vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    createApp: vi.fn(),
    h: vi.fn((..._args: any[]) => ({})),
  };
});

vi.mock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));

vi.mock("../src/i18n", () => ({
  loadTranslations: vi.fn(),
  loadCloudTranslations: vi.fn(),
}));

vi.mock("../src/composables", () => ({
  useFonts: vi.fn(() => ({ fonts: { value: [] } })),
}));

vi.mock("../src/utils/toMjml", () => ({
  toMjmlForInstance: vi.fn(),
}));

describe("editor entry — concurrent init does not orphan first app", () => {
  let initFn: typeof import("../src/index").init;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("vue", async () => {
      const actual = await vi.importActual<typeof import("vue")>("vue");
      return {
        ...actual,
        createApp: vi.fn(),
        h: vi.fn((..._args: any[]) => ({})),
      };
    });
    vi.doMock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));
    vi.doMock("../src/i18n", () => ({
      loadTranslations: vi.fn(),
      loadCloudTranslations: vi.fn(),
    }));
    vi.doMock("../src/composables", () => ({
      useFonts: vi.fn(() => ({ fonts: { value: [] } })),
    }));
    vi.doMock("../src/utils/toMjml", () => ({
      toMjmlForInstance: vi.fn(),
    }));

    const mod = await import("../src/index");
    initFn = mod.init;
  });

  // An orphan is an app still mounted that nothing can unmount. Asserted by
  // outcome rather than mechanism: whatever the first call does, exactly one
  // app stays mounted, and only the later call's handle reaches it.
  it("OSS: concurrent init() leaves one app mounted, the later call's", async () => {
    const { loadTranslations } = await import("../src/i18n");
    let resolveFirst!: (v: any) => void;
    let resolveSecond!: (v: any) => void;
    vi.mocked(loadTranslations)
      .mockImplementationOnce(
        () => new Promise((r) => (resolveFirst = r)),
      )
      .mockImplementationOnce(
        () => new Promise((r) => (resolveSecond = r)),
      );

    const { createApp } = await import("vue");
    const apps: Array<{ mount: Mock; unmount: Mock }> = [];
    vi.mocked(createApp).mockImplementation(() => {
      const app = { mount: vi.fn(), unmount: vi.fn() };
      apps.push(app);
      return app as any;
    });
    const stillMounted = () =>
      apps.filter(
        (app) => app.mount.mock.calls.length > app.unmount.mock.calls.length,
      );

    const container = document.createElement("div");

    // Pin light DOM so the dom-stubs container (no `attachShadow`) is a
    // valid mount target. The race shape this test asserts is independent
    // of mount mode.
    const firstInit = initFn({ container, shadowDom: false } as any);
    const secondInit = initFn({ container, shadowDom: false } as any);

    resolveFirst({});
    await new Promise((r) => setTimeout(r, 10));
    resolveSecond({});
    const [first, second] = await Promise.all([firstInit, secondInit]);

    expect(stillMounted()).toHaveLength(1);
    expect(stillMounted()[0].mount).toHaveBeenCalledWith(container);

    first.unmount();
    expect(stillMounted()).toHaveLength(1);

    second.unmount();
    expect(stillMounted()).toEqual([]);
  });

  // `initCloud()` mounts through the same path. Its concurrency is covered
  // with real Vue in `instance-unmount.test.ts`.
});
