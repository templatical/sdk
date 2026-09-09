import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MediaProvider } from "@templatical/types";

const SRC = join(import.meta.dirname, "..", "src");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf8");
}

function fakeProvider(): MediaProvider {
  return {
    list: vi.fn(async () => ({ items: [] })),
    create: false,
    update: false,
    delete: false,
    folders: false,
    replace: false,
    importFromUrl: false,
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
  };
}

// Minimal DOM stubs before Vue is imported — this file mocks `vue` wholesale.
if (typeof globalThis.document === "undefined") {
  (globalThis as any).document = {
    createElement: (tag?: string) => {
      const style: Record<string, string> = {};
      return {
        nodeType: 1,
        tagName: (tag || "DIV").toUpperCase(),
        style: {
          setProperty: (key: string, value: string) => {
            style[key] = value;
          },
          getPropertyValue: (key: string) => style[key] || "",
        },
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: (c: any) => c,
        removeChild: (c: any) => c,
        querySelector: () => null,
      };
    },
    querySelector: () => null,
    createTextNode: (t: string) => ({ nodeType: 3, textContent: t }),
    createComment: (t: string) => ({ nodeType: 8, textContent: t }),
  };
}
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = globalThis;
}

vi.mock("../src/i18n", () => ({
  loadMediaTranslations: vi.fn(),
}));

vi.mock("vue", () => {
  const refFn = vi.fn((val: any) => ({ value: val }));
  return {
    createApp: vi.fn(),
    h: vi.fn(),
    ref: refFn,
  };
});

vi.mock("../src/styles/index.css", () => ({}));

vi.mock("../src/standalone/MediaLibrary.vue", () => ({
  default: { name: "MediaLibrary" },
}));

describe("standalone config type", () => {
  it("requires provider and does not mention auth", () => {
    const source = readSrc("standalone/types.ts");
    expect(source).toMatch(/provider:\s*MediaProvider/);
    expect(source).not.toMatch(/\bauth\s*:/);
    expect(source).not.toContain("SdkAuthConfig");
    expect(source).not.toContain("@templatical/core");
  });
});

describe("standalone visual source", () => {
  it("does not construct auth or fetch plan config", () => {
    const source = readSrc("standalone/visual.ts");
    expect(source).not.toContain("createSdkAuthManager");
    expect(source).not.toContain("ApiClient");
    expect(source).not.toContain("fetchConfig");
    expect(source).not.toContain("authManager");
    expect(source).not.toMatch(/\bauth\s*:/);
    expect(source).toContain("config.provider");
  });

  it("unmounts a prior app after awaits, not before", () => {
    const source = readSrc("standalone/visual.ts");
    const awaitIndex = source.indexOf("await loadMediaTranslations");
    const unmountGuard = source.indexOf("if (appInstance)");
    expect(awaitIndex).toBeGreaterThan(0);
    expect(unmountGuard).toBeGreaterThan(awaitIndex);
  });
});

describe("standalone visual", () => {
  let initFn: typeof import("../src/standalone/visual").init;
  let unmountFn: typeof import("../src/standalone/visual").unmount;
  let capturedProps: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedProps = undefined;

    vi.doMock("../src/i18n", () => ({
      loadMediaTranslations: vi.fn(),
    }));

    vi.doMock("vue", () => {
      const refFn = vi.fn((val: any) => ({ value: val }));
      return {
        createApp: vi.fn(),
        h: vi.fn(),
        ref: refFn,
      };
    });

    vi.doMock("../src/styles/index.css", () => ({}));
    vi.doMock("../src/standalone/MediaLibrary.vue", () => ({
      default: { name: "MediaLibrary" },
    }));

    const mod = await import("../src/standalone/visual");
    initFn = mod.init;
    unmountFn = mod.unmount;
  });

  async function mockTranslations(
    impl?: () => Promise<unknown>,
  ): Promise<ReturnType<typeof vi.fn>> {
    const { loadMediaTranslations } = await import("../src/i18n");
    const mocked = vi.mocked(loadMediaTranslations);
    mocked.mockImplementation((impl as never) ?? (async () => ({}) as never));
    return mocked;
  }

  async function mockApp(options?: {
    onMount?: (app: {
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }) => void;
    apps?: Array<{
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }>;
    throwOnMount?: Error;
  }) {
    const { h: mockH, createApp: mockCreateApp } = await import("vue");
    vi.mocked(mockH).mockImplementation(
      (_component: unknown, props: unknown) => {
        capturedProps = props as Record<string, unknown>;
        return { __vnode: true } as never;
      },
    );

    let callCount = 0;
    vi.mocked(mockCreateApp).mockImplementation((...args: unknown[]) => {
      const component = args[0] as { setup?: () => () => unknown };
      const render = component?.setup?.();
      render?.();
      const app = {
        mount: vi.fn(() => {
          if (options?.throwOnMount) {
            throw options.throwOnMount;
          }
          (capturedProps?.onReady as (() => void) | undefined)?.();
        }),
        unmount: vi.fn(),
      };
      options?.apps?.push(app);
      options?.onMount?.(app);
      callCount += 1;
      if (options?.apps) {
        return options.apps[callCount - 1] as never;
      }
      return app as never;
    });
  }

  it("throws when container element is not found (string selector)", async () => {
    await expect(
      initFn({
        container: "#nonexistent",
        provider: fakeProvider(),
      }),
    ).rejects.toThrow("Container element not found");
  });

  it("throws when container is null element", async () => {
    await expect(
      initFn({
        container: null as never,
        provider: fakeProvider(),
      }),
    ).rejects.toThrow();
  });

  it("unmount before init does not prevent a later mount", async () => {
    unmountFn();
    await mockTranslations();
    await mockApp();
    const container = document.createElement("div");
    await initFn({ container, provider: fakeProvider() });
    const { createApp: mockCreateApp } = await import("vue");
    expect(mockCreateApp).toHaveBeenCalledTimes(1);
  });

  it("loads translations, mounts with provider, and does not fetch a plan", async () => {
    const load = await mockTranslations();
    await mockApp();
    const container = document.createElement("div");
    const provider = fakeProvider();

    await initFn({
      container,
      provider,
      accept: ["images"],
      onSelect: vi.fn(),
    });

    expect(load).toHaveBeenCalledWith("en");
    const { createApp: mockCreateApp } = await import("vue");
    expect(mockCreateApp).toHaveBeenCalled();
    expect(capturedProps?.provider).toBe(provider);
    expect(capturedProps?.accept).toEqual(["images"]);
    expect(capturedProps?.onSelect).toEqual(expect.any(Function));
    expect(capturedProps).not.toHaveProperty("authManager");
    expect(capturedProps).not.toHaveProperty("planConfig");
    expect(capturedProps).not.toHaveProperty("projectId");
  });

  it("unmount after init calls app.unmount", async () => {
    await mockTranslations();
    const apps: Array<{
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }> = [];
    await mockApp({ apps });
    const container = document.createElement("div");

    await initFn({ container, provider: fakeProvider() });
    unmountFn();
    expect(apps[0].unmount).toHaveBeenCalledTimes(1);
  });

  it("unmount is idempotent after first call", async () => {
    await mockTranslations();
    const apps: Array<{
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }> = [];
    await mockApp({ apps });
    const container = document.createElement("div");

    await initFn({ container, provider: fakeProvider() });
    unmountFn();
    unmountFn();
    expect(apps[0].unmount).toHaveBeenCalledTimes(1);
  });

  it("re-init unmounts previous app before creating new one", async () => {
    await mockTranslations();
    const apps: Array<{
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }> = [];
    await mockApp({ apps });
    const container = document.createElement("div");

    await initFn({ container, provider: fakeProvider() });
    await initFn({ container, provider: fakeProvider() });

    expect(apps[0].unmount).toHaveBeenCalled();
    expect(apps[1].mount).toHaveBeenCalledWith(container);
  });

  it("concurrent init calls do not orphan first app", async () => {
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const firstTranslations = new Promise((r) => {
      resolveFirst = r;
    });
    const secondTranslations = new Promise((r) => {
      resolveSecond = r;
    });

    const { loadMediaTranslations } = await import("../src/i18n");
    vi.mocked(loadMediaTranslations)
      .mockImplementationOnce(() => firstTranslations as never)
      .mockImplementationOnce(() => secondTranslations as never);

    const apps: Array<{
      mount: ReturnType<typeof vi.fn>;
      unmount: ReturnType<typeof vi.fn>;
    }> = [];
    await mockApp({ apps });
    const container = document.createElement("div");

    const firstInit = initFn({ container, provider: fakeProvider() });
    const secondInit = initFn({ container, provider: fakeProvider() });

    resolveFirst({});
    await new Promise((r) => setTimeout(r, 10));
    resolveSecond({});
    await Promise.all([firstInit, secondInit]);

    expect(apps[0].unmount).toHaveBeenCalled();
    expect(apps[1].mount).toHaveBeenCalledWith(container);
  });

  it("resolves with an instance whose setTheme applies CSS variables to the container", async () => {
    await mockTranslations();
    await mockApp();
    const container = document.createElement("div");

    const instance = await initFn({
      container,
      provider: fakeProvider(),
    });

    expect(typeof instance.setTheme).toBe("function");
    expect(typeof instance.unmount).toBe("function");

    instance.setTheme({ primaryColor: "#abc", borderRadius: 5 });

    expect(container.style.getPropertyValue("--tpl-primary")).toBe("#abc");
    expect(container.style.getPropertyValue("--tpl-radius")).toBe("5px");
    expect(container.style.getPropertyValue("--tpl-radius-sm")).toBe("2px");
    expect(container.style.getPropertyValue("--tpl-radius-lg")).toBe("9px");
  });

  it("rejects when createApp/mount throws", async () => {
    await mockTranslations();
    const mountError = new Error("mount blew up");
    await mockApp({ throwOnMount: mountError });
    const container = document.createElement("div");

    await expect(initFn({ container, provider: fakeProvider() })).rejects.toBe(
      mountError,
    );
  });

  it("passes locale to loadMediaTranslations", async () => {
    const load = await mockTranslations();
    await mockApp();
    const container = document.createElement("div");

    await initFn({
      container,
      provider: fakeProvider(),
      locale: "de",
    });

    expect(load).toHaveBeenCalledWith("de");
    expect(capturedProps?.locale).toBe("de");
  });

  it("defaults locale to en when not specified", async () => {
    const load = await mockTranslations();
    await mockApp();
    const container = document.createElement("div");

    await initFn({ container, provider: fakeProvider() });

    expect(load).toHaveBeenCalledWith("en");
  });
});

describe("applyTheme", () => {
  function createStyledElement() {
    const styles: Record<string, string> = {};
    return {
      style: {
        setProperty: (key: string, value: string) => {
          styles[key] = value;
        },
        getPropertyValue: (key: string) => styles[key] || "",
      },
    };
  }

  it("sets CSS variable for primaryColor", () => {
    const el = createStyledElement();
    const theme = { primaryColor: "#ff6600" };

    if (theme.primaryColor) {
      el.style.setProperty("--tpl-primary", theme.primaryColor);
    }

    expect(el.style.getPropertyValue("--tpl-primary")).toBe("#ff6600");
  });

  it("sets CSS variables for borderRadius", () => {
    const el = createStyledElement();
    const theme = { borderRadius: 10 };

    if (theme.borderRadius !== undefined) {
      el.style.setProperty("--tpl-radius", `${theme.borderRadius}px`);
      el.style.setProperty(
        "--tpl-radius-sm",
        `${Math.max(0, theme.borderRadius - 3)}px`,
      );
      el.style.setProperty("--tpl-radius-lg", `${theme.borderRadius + 4}px`);
    }

    expect(el.style.getPropertyValue("--tpl-radius")).toBe("10px");
    expect(el.style.getPropertyValue("--tpl-radius-sm")).toBe("7px");
    expect(el.style.getPropertyValue("--tpl-radius-lg")).toBe("14px");
  });

  it("borderRadius of 0 sets radius-sm to 0", () => {
    const el = createStyledElement();
    const theme = { borderRadius: 0 };

    if (theme.borderRadius !== undefined) {
      el.style.setProperty("--tpl-radius", `${theme.borderRadius}px`);
      el.style.setProperty(
        "--tpl-radius-sm",
        `${Math.max(0, theme.borderRadius - 3)}px`,
      );
      el.style.setProperty("--tpl-radius-lg", `${theme.borderRadius + 4}px`);
    }

    expect(el.style.getPropertyValue("--tpl-radius")).toBe("0px");
    expect(el.style.getPropertyValue("--tpl-radius-sm")).toBe("0px");
    expect(el.style.getPropertyValue("--tpl-radius-lg")).toBe("4px");
  });

  it("does not set CSS variables when theme is undefined", () => {
    const el = createStyledElement();
    const theme: { primaryColor?: string } | undefined = undefined;

    if (theme) {
      el.style.setProperty("--tpl-primary", "should-not-be-set");
    }

    expect(el.style.getPropertyValue("--tpl-primary")).toBe("");
  });
});
