// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { MediaLibraryModal } from "@templatical/media-library";

import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

/**
 * `MediaLibraryModal` mounted the way `cloud/components/CloudPanels.vue` mounts
 * it — inside the editor's own component tree.
 *
 * The editor provides its translations under `TRANSLATIONS_KEY`, a `Symbol`.
 * Vue matches injection keys by identity, so a bare-string `inject("translations")`
 * inside `@templatical/media-library` never resolves it and yields `undefined` —
 * which every `t.mediaLibrary.*` read in the modal then throws on. Nothing else
 * covers this: media-library's own i18n tests pass translations through
 * `useI18n(override)`, and no other test or e2e mounts the modal inside an editor.
 *
 * The modal therefore has to source its strings itself, from its `locale` prop.
 * These cases assert it does, with the editor's provides in scope and no
 * string-keyed translations anywhere.
 */

/** The three cross-package props, stubbed just enough to reach a render. */
function hostProps(locale?: string, uiTheme?: string) {
  return {
    visible: true,
    locale,
    uiTheme,
    projectId: "proj-1",
    authManager: {
      projectId: "proj-1",
      getToken: vi.fn(async () => "tok"),
      onError: vi.fn(),
    } as never,
    planConfig: {
      config: ref({
        media: { max_file_size: 1024, categories: {} },
        storage: { used_bytes: 0, limit_bytes: 1024 },
      }),
      isLoading: ref(false),
      hasFeature: vi.fn(() => true),
      features: computed(() => null),
      fetchConfig: vi.fn(),
    } as never,
  };
}

/**
 * Wraps the modal in a component that provides exactly what the editor provides
 * — the `Symbol`-keyed editor translations — and deliberately nothing under the
 * bare string `"translations"`.
 */
function mountInEditorTree(locale?: string, uiTheme?: string) {
  const Host = defineComponent({
    setup() {
      return () => h(MediaLibraryModal as never, hostProps(locale, uiTheme));
    },
  });
  return mount(Host, {
    global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
    attachTo: document.body,
  });
}

/**
 * A string rendered by `MediaUploadZone`, i.e. a **descendant** that resolves
 * `TRANSLATIONS_KEY` through the modal's `provide`.
 *
 * Asserting on the modal's own header instead would prove nothing: the modal
 * reads the ref it loaded directly, so its labels are correct even with the
 * `provide` deleted, and `useI18n`'s English floor keeps descendants rendering
 * too. Only a descendant string *in a non-English locale* distinguishes "the
 * provide reaches the subtree" from "everything silently fell back".
 */
const DESCENDANT = {
  en: "Drop files here or click to upload",
  de: "Dateien hierher ziehen oder klicken zum Hochladen",
};

describe("MediaLibraryModal inside the editor's tree", () => {
  it("mounts at all — its own useMediaCategories cannot inject its own provide", async () => {
    const wrapper = mountInEditorTree();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Media Library");
    });
    wrapper.unmount();
  });

  it("resolves English in descendants when the host provides only Symbol-keyed translations", async () => {
    const wrapper = mountInEditorTree();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(DESCENDANT.en);
    });
    wrapper.unmount();
  });

  it("carries the handed locale all the way into descendants", async () => {
    const wrapper = mountInEditorTree("de");
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Medienbibliothek");
    });
    // The load is what makes this meaningful: with the provide dropped, the
    // header is still German while this line falls back to English.
    expect(document.body.textContent).toContain(DESCENDANT.de);
    expect(document.body.textContent).not.toContain(DESCENDANT.en);
    wrapper.unmount();
  });

  /**
   * The overlay stamps `data-tpl-theme`, and it used to read a bare-string
   * `inject("tplUiTheme")` that never resolved the editor's identically-named
   * `Symbol` — so the library rendered light inside a dark editor.
   */
  it("stamps the host's resolved UI theme onto the overlay", async () => {
    const wrapper = mountInEditorTree(undefined, "dark");
    await vi.waitFor(() => {
      expect(
        document.body.querySelector('[data-tpl-theme="dark"]'),
      ).not.toBeNull();
    });
    wrapper.unmount();
  });

  /**
   * The three sub-modals teleport out of the modal's DOM and so read the theme
   * through `UI_THEME_KEY` rather than a prop. They render only while open,
   * which is why this opens one: with the `provide` deleted the assertion above
   * still passes (the overlay uses the modal's own computed) and only this fails.
   */
  it("carries the theme through the provide into a teleported sub-modal", async () => {
    const wrapper = mountInEditorTree(undefined, "dark");
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Import from URL");
    });
    const before = document.body.querySelectorAll('[data-tpl-theme="dark"]').length;

    const trigger = [...document.body.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Import from URL"),
    );
    expect(trigger).toBeDefined();
    (trigger as HTMLButtonElement).click();

    // The sub-modal is an additional themed root, so the count must grow —
    // asserting mere presence would be satisfied by the overlay alone.
    await vi.waitFor(() => {
      expect(
        document.body.querySelectorAll('[data-tpl-theme="dark"]').length,
      ).toBeGreaterThan(before);
    });
    wrapper.unmount();
  });

  it("falls back to English for a locale it does not ship", async () => {
    const wrapper = mountInEditorTree("xx-XX");
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(DESCENDANT.en);
    });
    wrapper.unmount();
  });
});
