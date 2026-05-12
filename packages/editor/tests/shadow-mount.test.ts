// @vitest-environment happy-dom
//
// Uses happy-dom (real Shadow DOM + CSSStyleSheet support) instead of the
// minimal dom-stubs other editor tests use — this spec genuinely exercises
// `attachShadow`, `adoptedStyleSheets`, and `container.shadowRoot`.

import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Smoke test for the Shadow DOM mount infrastructure.
 *
 * Asserts that `init({ shadowDom: true })` (a) attaches an open shadow root
 * to the consumer's container, (b) adopts a non-empty stylesheet onto it,
 * (c) mounts Vue onto a fresh `<div class="tpl-editor-host">` inside the
 * shadow root, and (d) passes the shadow root to `Editor.vue` as a prop so
 * `useEditorCore` can provide `EDITOR_ROOT_KEY`.
 *
 * Also verifies the explicit-opt-out path (`shadowDom: false`) leaves the
 * container untouched and mounts Vue directly on it, and that omitting the
 * flag entirely defers to the SDK default (shadow DOM since Phase 7).
 *
 * Vue / Editor.vue / i18n are mocked the same way as `index-init.test.ts`
 * so the test exercises just the mount-resolver logic, not the editor's
 * full bootstrap.
 */

describe("editor shadow mount (Phase 1.5)", () => {
  let initFn: typeof import("../src/index").init;
  let createAppMock: ReturnType<typeof vi.fn>;
  let mountedOn: Element | null;
  let editorPropsCaptured: Record<string, unknown> | null;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mountedOn = null;
    editorPropsCaptured = null;

    const fakeApp = {
      mount: vi.fn((el: Element) => {
        mountedOn = el;
      }),
      unmount: vi.fn(),
    };

    createAppMock = vi.fn((options: { setup: () => () => unknown }) => {
      // Invoke setup() then the returned render fn to capture the props
      // h() was called with for <Editor>. The mock h captures args below.
      const renderFn = options.setup();
      renderFn();
      return fakeApp;
    });

    vi.doMock("vue", async () => {
      const actual = await vi.importActual<typeof import("vue")>("vue");
      return {
        ...actual,
        createApp: createAppMock,
        h: vi.fn((_comp: unknown, props: Record<string, unknown>) => {
          editorPropsCaptured = props;
          return {};
        }),
      };
    });
    vi.doMock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));
    vi.doMock("../src/cloud/CloudEditor.vue", () => ({
      default: { name: "CloudEditor" },
    }));
    vi.doMock("../src/i18n", () => ({
      loadTranslations: vi.fn(() => Promise.resolve({} as Record<string, unknown>)),
      loadCloudTranslations: vi.fn(() => Promise.resolve({} as Record<string, unknown>)),
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

  it("`shadowDom: true` attaches an open shadow root, adopts a stylesheet, and mounts on the host div", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await initFn({
      container,
      shadowDom: true,
      content: {} as Parameters<typeof initFn>[0]["content"],
    });

    expect(container.shadowRoot).not.toBeNull();
    expect(container.shadowRoot?.mode).toBe("open");

    const sheets = container.shadowRoot!.adoptedStyleSheets;
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets[0]).toBeInstanceOf(CSSStyleSheet);

    // Vue mounted onto the host div inside the shadow root.
    expect(mountedOn).not.toBeNull();
    expect(mountedOn).toBeInstanceOf(HTMLDivElement);
    expect((mountedOn as HTMLDivElement).className).toBe("tpl-editor-host");
    expect((mountedOn as HTMLDivElement).parentNode).toBe(container.shadowRoot);

    // Editor.vue received the shadow root as a prop (so useEditorCore can
    // provide EDITOR_ROOT_KEY).
    expect(editorPropsCaptured).not.toBeNull();
    expect(editorPropsCaptured!.shadowRoot).toBe(container.shadowRoot);
  });

  it("`shadowDom: false` mounts directly on container — no shadow root", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await initFn({
      container,
      shadowDom: false,
      content: {} as Parameters<typeof initFn>[0]["content"],
    });

    expect(container.shadowRoot).toBeNull();
    expect(mountedOn).toBe(container);
    expect(editorPropsCaptured!.shadowRoot).toBeUndefined();
  });

  it("omitted `shadowDom` defaults to shadow DOM (Phase 7 default)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await initFn({
      container,
      content: {} as Parameters<typeof initFn>[0]["content"],
    });

    expect(container.shadowRoot).not.toBeNull();
    expect(container.shadowRoot?.mode).toBe("open");
    expect(mountedOn).toBeInstanceOf(HTMLDivElement);
    expect((mountedOn as HTMLDivElement).className).toBe("tpl-editor-host");
    expect((mountedOn as HTMLDivElement).parentNode).toBe(container.shadowRoot);
    expect(editorPropsCaptured!.shadowRoot).toBe(container.shadowRoot);
  });

  it("re-initializing on the same container reuses the existing shadow root and clears stale content", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await initFn({
      container,
      shadowDom: true,
      content: {} as Parameters<typeof initFn>[0]["content"],
    });

    const firstShadow = container.shadowRoot!;
    expect(firstShadow).not.toBeNull();
    // Drop a marker element so we can verify it gets cleared on re-init.
    const marker = document.createElement("span");
    marker.id = "stale-marker";
    firstShadow.appendChild(marker);
    expect(firstShadow.querySelector("#stale-marker")).not.toBeNull();

    await initFn({
      container,
      shadowDom: true,
      content: {} as Parameters<typeof initFn>[0]["content"],
    });

    // Same shadow root — `attachShadow` would throw on a re-attach, so the
    // resolver MUST reuse the existing one.
    expect(container.shadowRoot).toBe(firstShadow);
    // The marker was cleared as part of the re-init.
    expect(firstShadow.querySelector("#stale-marker")).toBeNull();
    // The fresh tpl-editor-host div is present.
    expect(firstShadow.querySelector(".tpl-editor-host")).not.toBeNull();
  });
});
