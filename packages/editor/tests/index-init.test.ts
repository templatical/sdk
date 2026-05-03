import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";

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
vi.mock("../src/cloud/CloudEditor.vue", () => ({
  default: { name: "CloudEditor" },
}));

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
    vi.doMock("../src/cloud/CloudEditor.vue", () => ({
      default: { name: "CloudEditor" },
    }));
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

  it("OSS: concurrent init() unmounts first app before mounting second", async () => {
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
    const firstApp = { mount: vi.fn(), unmount: vi.fn() };
    const secondApp = { mount: vi.fn(), unmount: vi.fn() };
    let createCount = 0;
    vi.mocked(createApp).mockImplementation(
      () => ((createCount++ === 0 ? firstApp : secondApp) as any),
    );

    const container = document.createElement("div");

    const firstInit = initFn({ container } as any);
    const secondInit = initFn({ container } as any);

    resolveFirst({});
    await new Promise((r) => setTimeout(r, 10));
    resolveSecond({});
    await new Promise((r) => setTimeout(r, 10));

    firstInit.catch(() => {});
    secondInit.catch(() => {});

    expect(firstApp.unmount).toHaveBeenCalled();
    expect(secondApp.mount).toHaveBeenCalledWith(container);
  });

  // Cloud equivalent: initCloud has the same race shape (guard checked
  // before awaits). Not unit-tested here because the dynamic CloudEditor.vue
  // import pulls in vuedraggable/sortablejs which needs a real DOM. Fix
  // mirrors the OSS one — guard moved after awaits in src/index.ts.
});
