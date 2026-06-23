// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SMALL_SCREEN_QUERY,
  useSmallScreenNotice,
} from "../src/composables/useSmallScreenNotice";
import SmallScreenNotice from "../src/components/SmallScreenNotice.vue";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

/**
 * Stub `window.matchMedia` so `useMediaQuery` resolves to a fixed `matches`.
 * vueuse reads `window.matchMedia(query).matches` on setup.
 */
function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const scopes: EffectScope[] = [];

/** Run the composable inside a disposable scope so `useMediaQuery` cleans up. */
function run(enabled?: boolean | (() => boolean | undefined)) {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useSmallScreenNotice(enabled))!;
}

afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop());
  vi.unstubAllGlobals();
});

describe("useSmallScreenNotice", () => {
  it("targets the ~768px breakpoint", () => {
    expect(SMALL_SCREEN_QUERY).toBe("(max-width: 767px)");
  });

  it("shows the notice on a small viewport when enabled (default)", () => {
    stubMatchMedia(true);
    const { isSmallScreen, showNotice } = run();
    expect(isSmallScreen.value).toBe(true);
    expect(showNotice.value).toBe(true);
  });

  it("hides the notice on a wide viewport even when enabled", () => {
    stubMatchMedia(false);
    const { isSmallScreen, showNotice } = run(true);
    expect(isSmallScreen.value).toBe(false);
    expect(showNotice.value).toBe(false);
  });

  it("defaults to enabled when the flag is undefined", () => {
    stubMatchMedia(true);
    // `undefined` flag → opt-out semantics → notice still shows on small screens
    const { showNotice } = run(undefined);
    expect(showNotice.value).toBe(true);
  });

  it("never shows the notice when explicitly disabled, even on a small viewport", () => {
    stubMatchMedia(true);
    const { isSmallScreen, showNotice } = run(false);
    expect(isSmallScreen.value).toBe(true);
    expect(showNotice.value).toBe(false);
  });

  it("accepts a getter for the flag (reactive config source)", () => {
    stubMatchMedia(true);
    const { showNotice } = run(() => false);
    expect(showNotice.value).toBe(false);
  });
});

describe("SmallScreenNotice component", () => {
  function mountNotice() {
    return mount(SmallScreenNotice, {
      global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
    });
  }

  it("renders the localized title and message", () => {
    const wrapper = mountNotice();
    expect(wrapper.get("h2").text()).toBe(en.smallScreen.title);
    expect(wrapper.get("p").text()).toBe(en.smallScreen.message);
  });

  it("renders an icon and exposes the message to assistive tech", () => {
    const wrapper = mountNotice();
    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.get(".tpl-small-screen-notice").attributes("role")).toBe(
      "status",
    );
  });

  it("carries the data-testid the e2e gate spec targets", () => {
    // Locks the selector contract in apps/playground/e2e: drop this attribute
    // and the real-browser gate spec silently stops finding the notice.
    expect(mountNotice().attributes("data-testid")).toBe("small-screen-notice");
  });

  it("layers above all chrome and popovers via a literal top z-index", () => {
    const wrapper = mountNotice();
    // A literal z-index, NOT var(--z-modal) / a tpl:z-* utility — neither
    // resolves inside the shadow root, so they'd leave the overlay at z-auto
    // beneath the chrome (the #235 follow-up bug). 10001 clears the chrome
    // (z-50/40) and .tpl-popover-root (z-10000).
    expect(wrapper.attributes("style")).toContain("z-index: 10001");
    expect(wrapper.classes()).toContain("tpl:absolute");
    expect(wrapper.classes()).toContain("tpl:inset-0");
  });
});

describe("editor wiring (#235)", () => {
  const src = (p: string) =>
    readFileSync(join(__dirname, "..", "src", p), "utf8");

  it.each([
    ["Editor.vue", "Editor.vue"],
    ["cloud/CloudEditor.vue", "CloudEditor.vue"],
  ])("%s gates the chrome behind the small-screen notice", (path) => {
    const code = src(path);
    expect(code).toContain("useSmallScreenNotice(");
    expect(code).toContain("() => props.config.smallScreenNotice");
    expect(code).toContain(
      '<SmallScreenNotice v-if="showSmallScreenNotice" />',
    );
  });
});
