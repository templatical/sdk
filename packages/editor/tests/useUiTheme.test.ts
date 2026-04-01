// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createApp, defineComponent, h, ref, nextTick } from "vue";
import type { UiTheme } from "@templatical/types";
import { useUiTheme } from "../src/composables/useUiTheme";

function withSetup<T>(setup: () => T): { result: T; unmount: () => void } {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  return { result: result!, unmount: () => app.unmount() };
}

describe("useUiTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function mockMatchMedia(matches: boolean) {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    const mql = {
      matches,
      addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      }),
      removeEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      }),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql);
    return { mql, listeners };
  }

  it("resolves 'light' when uiTheme is light", () => {
    const uiTheme = ref<UiTheme>("light");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");
    unmount();
  });

  it("resolves 'dark' when uiTheme is dark", () => {
    const uiTheme = ref<UiTheme>("dark");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
  });

  it("resolves 'light' when auto and system prefers light", () => {
    mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");
    unmount();
  });

  it("resolves 'dark' when auto and system prefers dark", () => {
    mockMatchMedia(true);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
  });

  it("creates matchMedia listener only when auto", () => {
    mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("light");
    const { unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(window.matchMedia).not.toHaveBeenCalled();
    unmount();
  });

  it("creates matchMedia listener when auto", () => {
    const { mql } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
    expect(mql.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    unmount();
  });

  it("reacts to system preference changes in auto mode", () => {
    const { listeners } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");

    // Simulate system dark mode toggle
    listeners[0]({ matches: true } as MediaQueryListEvent);
    expect(result.resolvedTheme.value).toBe("dark");

    // Simulate back to light
    listeners[0]({ matches: false } as MediaQueryListEvent);
    expect(result.resolvedTheme.value).toBe("light");
    unmount();
  });

  it("cleans up matchMedia listener when switching from auto to explicit", async () => {
    const { mql } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(mql.addEventListener).toHaveBeenCalled();

    uiTheme.value = "dark";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("dark");
    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    unmount();
  });

  it("cleans up matchMedia listener on unmount", () => {
    const { mql } = mockMatchMedia(true);
    const uiTheme = ref<UiTheme>("auto");
    const { unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(mql.addEventListener).toHaveBeenCalled();
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("switching from light to auto sets up listener", async () => {
    const { mql } = mockMatchMedia(true);
    const uiTheme = ref<UiTheme>("light");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");
    expect(window.matchMedia).not.toHaveBeenCalled();

    uiTheme.value = "auto";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("dark");
    expect(mql.addEventListener).toHaveBeenCalled();
    unmount();
  });

  it("does not create duplicate listeners on multiple auto switches", async () => {
    const { mql } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { unmount } = withSetup(() => useUiTheme(uiTheme));

    // Switch away and back
    uiTheme.value = "light";
    await nextTick();
    uiTheme.value = "auto";
    await nextTick();

    // Should have cleaned up first listener, then created a new one
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
    // 1 initial + 1 after switching back = 2 addEventListener calls
    expect(mql.addEventListener).toHaveBeenCalledTimes(2);
    unmount();
  });
});
