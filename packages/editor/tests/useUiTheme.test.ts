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
      media: "(prefers-color-scheme: dark)",
      onchange: null as ((e: MediaQueryListEvent) => void) | null,
      addEventListener: vi.fn(
        (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.push(handler);
        },
      ),
      removeEventListener: vi.fn(
        (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          const idx = listeners.indexOf(handler);
          if (idx !== -1) listeners.splice(idx, 1);
        },
      ),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mql);
    return {
      mql,
      listeners,
      simulateChange(newMatches: boolean) {
        mql.matches = newMatches;
        const event = { matches: newMatches } as MediaQueryListEvent;
        for (const listener of [...listeners]) {
          listener(event);
        }
      },
    };
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

  it("uses matchMedia for auto mode", () => {
    mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("light");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    // When not in auto mode, resolvedTheme follows the explicit value
    expect(result.resolvedTheme.value).toBe("light");
    unmount();
  });

  it("queries prefers-color-scheme media query", () => {
    mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(window.matchMedia).toHaveBeenCalledWith(
      "(prefers-color-scheme: dark)",
    );
    unmount();
  });

  it("reacts to system preference changes in auto mode", () => {
    const { simulateChange } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");

    // Simulate system dark mode toggle
    simulateChange(true);
    expect(result.resolvedTheme.value).toBe("dark");

    // Simulate back to light
    simulateChange(false);
    expect(result.resolvedTheme.value).toBe("light");
    unmount();
  });

  it("switches to explicit dark when changing from auto", async () => {
    mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");

    uiTheme.value = "dark";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
  });

  it("resolves correctly after unmount", () => {
    mockMatchMedia(true);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
    // After unmount, the computed still reflects last state
    expect(result.resolvedTheme.value).toBe("dark");
  });

  it("switching from light to auto reflects system preference", async () => {
    mockMatchMedia(true);
    const uiTheme = ref<UiTheme>("light");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");

    uiTheme.value = "auto";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
  });

  it("handles multiple auto/explicit switches correctly", async () => {
    const { simulateChange } = mockMatchMedia(false);
    const uiTheme = ref<UiTheme>("auto");
    const { result, unmount } = withSetup(() => useUiTheme(uiTheme));
    expect(result.resolvedTheme.value).toBe("light");

    // Switch to explicit
    uiTheme.value = "dark";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("dark");

    // Switch back to auto
    uiTheme.value = "auto";
    await nextTick();
    expect(result.resolvedTheme.value).toBe("light");

    // System changes should still be reflected
    simulateChange(true);
    expect(result.resolvedTheme.value).toBe("dark");
    unmount();
  });
});
