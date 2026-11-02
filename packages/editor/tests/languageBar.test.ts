// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import LanguageBar from "../src/components/localization/LanguageBar.vue";
import en from "../src/i18n/locales/en";
import { TRANSLATIONS_KEY } from "../src/keys";
import { createTitleBlock, type TranslationRequest } from "@templatical/types";
import type {
  TranslationRunResult,
  UseTranslationFeatureReturn,
} from "../src/composables/useTranslationFeature";
import {
  chooseLanguage,
  languageContent,
  openLanguages,
} from "./helpers/localization";

const id = (value: string) => `[data-testid="${value}"]`;
const provider = {
  translate: async (request: TranslationRequest) => ({
    fields: request.fields.map(({ id, text }) => ({ id, text: `DE ${text}` })),
  }),
};

function observeChrome() {
  const observers = new Map<
    Element,
    { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }
  >();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(element: Element) {
        observers.set(element, {
          callback: this.callback,
          disconnect: this.disconnect,
        });
      }
      disconnect = vi.fn();
    },
  );
  return observers;
}

function resizeEntry(target: Element, height: number, borderBox: boolean) {
  return {
    target,
    contentRect: { height },
    borderBoxSize: borderBox ? [{ blockSize: height, inlineSize: 600 }] : [],
  } as unknown as ResizeObserverEntry;
}

describe("language bar", () => {
  it("shows the active coverage only in a language view, including without a provider", async () => {
    const { wrapper } = await openLanguages();
    expect(wrapper.find(id("language-bar")).exists()).toBe(false);
    await chooseLanguage(wrapper, "de");
    expect(wrapper.get(id("language-bar")).text()).toContain("Editing Deutsch");
    const status = wrapper.get(id("language-bar-status"));
    expect(status.text()).toBe("1 missing, 1 out of date");
    expect(status.attributes("aria-live")).toBe("polite");
    expect(wrapper.find(id("translate-language")).exists()).toBe(false);
    expect(wrapper.find(id("translate-all-again")).exists()).toBe(false);
    await chooseLanguage(wrapper, "fr");
    expect(wrapper.get(id("language-bar-status")).text()).toBe(
      "Read-only: Français isn't enabled",
    );
    const disabled = await openLanguages({ localization: { locales: ["nl"] } });
    await chooseLanguage(disabled.wrapper, "de");
    expect(disabled.wrapper.get(id("language-bar-status")).text()).toBe(
      "Read-only: Deutsch isn't enabled",
    );

    await wrapper.get(id("language-back-default")).trigger("click");
    expect(wrapper.find(id("language-bar")).exists()).toBe(false);
  });

  it("moves translation actions out of the menu and hides the primary action when complete", async () => {
    const { wrapper, history } = await openLanguages({ translation: provider });
    await chooseLanguage(wrapper, "de");
    const bar = wrapper.get(id("language-bar"));
    expect(bar.get(id("translate-language")).text()).toBe("Translate 2 fields");
    expect(bar.get(id("translate-language")).classes()).toContain(
      "tpl:bg-[var(--tpl-primary)]",
    );
    await wrapper.get(id("language-menu")).trigger("click");
    expect(
      wrapper.get('[role="menu"]').find(id("translate-language")).exists(),
    ).toBe(false);
    expect(
      wrapper.get('[role="menu"]').find(id("translate-all-again")).exists(),
    ).toBe(false);
    await wrapper.get(id("language-menu")).trigger("click");
    await bar.get(id("translate-language")).trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get(id("translation-result")).text()).toBe(
        "Translated 2 fields.",
      ),
    );
    await wrapper.get(id("translation-dismiss")).trigger("click");
    expect(wrapper.get(id("language-bar-status")).text()).toBe("Complete");
    expect(wrapper.find(id("translate-language")).exists()).toBe(false);
    expect(
      bar.get(id("translate-all-again")).attributes("disabled"),
    ).toBeUndefined();
    history.undo();
  });

  it("uses the singular primary label for one eligible gap", async () => {
    const content = languageContent();
    content.blocks = [content.blocks[1]];
    const { wrapper } = await openLanguages({ content, translation: provider });
    await chooseLanguage(wrapper, "de");
    expect(
      wrapper.get(id("language-bar")).get(id("translate-language")).text(),
    ).toBe("Translate 1 field");
  });

  it("confirms all 40 fields with the replacement and undo explanation", async () => {
    const content = languageContent();
    content.blocks = Array.from({ length: 40 }, (_, i) =>
      createTitleBlock({ id: `t${i}`, content: `Hello ${i}` }),
    );
    const { wrapper, editor } = await openLanguages({
      content,
      translation: provider,
    });
    await chooseLanguage(wrapper, "de");
    await wrapper
      .get(id("language-bar"))
      .get(id("translate-all-again"))
      .trigger("click");
    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe(
      "Translate all 40 fields again?",
    );
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "This replaces the current Deutsch translations, including manual edits. You can undo it.",
    );
    expect(wrapper.get(id("translation-confirm")).text()).toBe(
      "Translate all 40 fields",
    );
    await wrapper.get(id("translation-confirm-cancel")).trigger("click");
    expect(editor.state.isDirty).toBe(false);
    await wrapper.get(id("translate-all-again")).trigger("click");
    await wrapper.get(id("translation-confirm")).trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get(id("translation-result")).text()).toBe(
        "Translated 40 fields.",
      ),
    );
  });

  it("announces 12 of 40, invokes Cancel and renders every result part until dismissed", async () => {
    const { wrapper } = await openLanguages({ translation: provider });
    await chooseLanguage(wrapper, "de");
    expect(wrapper.find(id("language-bar")).exists()).toBe(true);
    const running = ref<{ done: number; total: number } | null>({
      done: 12,
      total: 40,
    });
    const lastResult = ref<TranslationRunResult | null>({
      translated: 38,
      tagsChanged: ["a", "b"],
      skippedLocked: ["c", "d", "e"],
      missing: ["f"],
      tooLarge: [],
      error: { code: "rate_limited", message: "Try later" },
      cancelled: false,
    });
    const cancel = vi.fn(() => {
      running.value = null;
    });
    const feature: UseTranslationFeatureReturn = {
      isAvailable: computed(() => true),
      counts: computed(() => ({ gaps: 2, all: 40 })),
      running,
      lastResult,
      cancel,
      translate: async () => lastResult.value!,
      dismissResult: () => {
        lastResult.value = null;
      },
    };
    const bar = mount(LanguageBar, {
      props: {
        ...wrapper.findComponent(LanguageBar).props(),
        feature,
      } as never,
      global: {
        provide: { [TRANSLATIONS_KEY as symbol]: en },
        stubs: { teleport: true },
      },
    });
    try {
      expect(bar.get(id("language-bar-status")).text()).toContain(
        "Translating 12 of 40…",
      );
      await bar.get(id("translation-cancel")).trigger("click");
      expect(cancel).toHaveBeenCalledOnce();
      expect(bar.get(id("translation-result")).text()).toBe(
        "Translated 38 fields. 2 kept because their tags changed. 3 skipped because someone is editing them. 1 not returned. The translation service said: Try later",
      );
      lastResult.value = {
        ...lastResult.value!,
        translated: 2,
        tagsChanged: ["a"],
        skippedLocked: ["b", "c"],
        missing: ["d"],
      };
      await nextTick();
      expect(bar.get(id("translation-result")).text()).toBe(
        "Translated 2 fields. 1 kept because their tags changed. 2 skipped because someone is editing them. 1 not returned. The translation service said: Try later",
      );
      await bar.get(id("translation-dismiss")).trigger("click");
      expect(bar.find(id("translation-result")).exists()).toBe(false);
      expect(bar.get(id("language-bar-status")).text()).toBe(
        "1 missing, 1 out of date",
      );
    } finally {
      bar.unmount();
    }
  });

  it("reports a field over the cap as the editor's own limit, not the service's", async () => {
    const { wrapper } = await openLanguages({ translation: provider });
    await chooseLanguage(wrapper, "de");
    const lastResult = ref<TranslationRunResult | null>({
      translated: 1,
      tagsChanged: [],
      skippedLocked: [],
      missing: [],
      tooLarge: ["title/content"],
      error: null,
      cancelled: false,
    });
    const feature: UseTranslationFeatureReturn = {
      isAvailable: computed(() => true),
      counts: computed(() => ({ gaps: 1, all: 2 })),
      running: ref(null),
      lastResult,
      cancel: () => {},
      translate: async () => lastResult.value!,
      dismissResult: () => {
        lastResult.value = null;
      },
    };
    const bar = mount(LanguageBar, {
      props: {
        ...wrapper.findComponent(LanguageBar).props(),
        feature,
      } as never,
      global: {
        provide: { [TRANSLATIONS_KEY as symbol]: en },
        stubs: { teleport: true },
      },
    });
    try {
      expect(bar.get(id("translation-result")).text()).toBe(
        "Translated 1 field. 1 field is too long to translate.",
      );
      lastResult.value = {
        ...lastResult.value!,
        tooLarge: ["a", "b"],
      };
      await nextTick();
      expect(bar.get(id("translation-result")).text()).toBe(
        "Translated 1 field. 2 fields are too long to translate.",
      );
    } finally {
      bar.unmount();
    }
  });

  it("cancels a real run and dismisses the zero-field partial result", async () => {
    const { wrapper } = await openLanguages({
      translation: { translate: async () => new Promise(() => {}) },
    });
    await chooseLanguage(wrapper, "de");
    await wrapper
      .get(id("language-bar"))
      .get(id("translate-language"))
      .trigger("click");
    const status = wrapper.get(id("language-bar-status"));
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toContain("Translating 0 of 2…");
    await wrapper.get(id("translation-cancel")).trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get(id("translation-result")).text()).toBe(
        "Translated 0 fields.",
      ),
    );
    await wrapper.get(id("translation-dismiss")).trigger("click");
    expect(wrapper.find(id("translation-result")).exists()).toBe(false);
    expect(wrapper.get(id("language-bar-status")).text()).toBe(
      "1 missing, 1 out of date",
    );
  });

  it("clears completed results on a view switch and returns to English from the bar", async () => {
    const { wrapper, editor } = await openLanguages({ translation: provider });
    await chooseLanguage(wrapper, "de");
    await wrapper
      .get(id("language-bar"))
      .get(id("translate-language"))
      .trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.find(id("translation-result")).exists()).toBe(true),
    );
    await chooseLanguage(wrapper, "fr");
    expect(wrapper.find(id("translation-result")).exists()).toBe(false);
    await chooseLanguage(wrapper, "de");
    expect(wrapper.find(id("translation-result")).exists()).toBe(false);
    expect(wrapper.get(id("language-back-default")).text()).toBe(
      "Back to English",
    );
    await wrapper.get(id("language-back-default")).trigger("click");
    expect(editor.activeLocale.value).toBeNull();
    expect(wrapper.find(id("language-bar")).exists()).toBe(false);
  });

  it("keeps partial results in the captured language when switching during a run", async () => {
    const content = languageContent();
    content.blocks = Array.from({ length: 51 }, (_, i) =>
      createTitleBlock({ id: `t${i}`, content: `Hello ${i}` }),
    );
    let calls = 0;
    let signal!: AbortSignal;
    const { wrapper, editor } = await openLanguages({
      content,
      translation: {
        translate: async (request, abort) => {
          signal = abort;
          calls++;
          return calls === 1
            ? provider.translate(request)
            : new Promise(() => {});
        },
      },
    });
    await chooseLanguage(wrapper, "de");
    await wrapper
      .get(id("language-bar"))
      .get(id("translate-language"))
      .trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.get(id("language-bar-status")).text()).toContain(
        "Translating 50 of 51…",
      ),
    );
    await chooseLanguage(wrapper, "fr");
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
    await vi.waitFor(() =>
      expect(
        editor.content.value.blocks.filter((block) => block.l10n?.de).length,
      ).toBe(50),
    );
    expect(editor.content.value.blocks.some((block) => block.l10n?.fr)).toBe(
      false,
    );
    expect(wrapper.find(id("translation-result")).exists()).toBe(false);
  });

  it("shows the structure notice once per session per template and dismisses it inside the bar", async () => {
    const { wrapper, editor } = await openLanguages({
      templates: {
        load: async (id) => ({ id, content: languageContent() }),
        create: false,
        save: false,
      },
    });
    await editor.load("bar-template-a");
    await chooseLanguage(wrapper, "de");
    expect(
      wrapper.get(id("language-bar")).find(id("structure-notice")).exists(),
    ).toBe(false);
    editor.addBlock(createTitleBlock());
    await nextTick();
    const notice = wrapper.get(id("language-bar")).get(id("structure-notice"));
    expect(notice.text()).toBe("Structure changes apply to every language.");
    await notice.get("button").trigger("click");
    editor.addBlock(createTitleBlock());
    await nextTick();
    expect(wrapper.find(id("structure-notice")).exists()).toBe(false);
    await editor.load("bar-template-b");
    await chooseLanguage(wrapper, "de");
    editor.addBlock(createTitleBlock());
    await nextTick();
    expect(
      wrapper.get(id("language-bar")).find(id("structure-notice")).exists(),
    ).toBe(true);
    await editor.load("bar-template-a");
    await chooseLanguage(wrapper, "de");
    editor.addBlock(createTitleBlock());
    await nextTick();
    expect(wrapper.find(id("structure-notice")).exists()).toBe(false);
  });

  it.each([true, false])(
    "measures unscaled layout height with borderBoxSize=%s, reacts to wrapping and releases its observer",
    async (borderBox) => {
      const observers = observeChrome();
      const { wrapper } = await openLanguages();
      const top = () =>
        (wrapper.get(".tpl-body").element as HTMLElement).style.top;
      expect(top()).toBe("calc(3.5 * var(--tpl-base-size) + 0px)");
      await chooseLanguage(wrapper, "de");
      const observed = wrapper.get(".tpl-top-chrome").element;
      expect(observers.has(observed)).toBe(true);
      expect(observed.contains(wrapper.get(id("language-bar")).element)).toBe(
        true,
      );
      const measure = async (height: number) => {
        vi.spyOn(observed, "getBoundingClientRect").mockReturnValue({
          height: height / 2,
        } as DOMRect);
        observers
          .get(observed)!
          .callback(
            [resizeEntry(observed, height, borderBox)],
            {} as ResizeObserver,
          );
        await nextTick();
      };
      await measure(54);
      expect(top()).toBe("calc(3.5 * var(--tpl-base-size) + 54px)");
      await measure(108);
      expect(top()).toBe("calc(3.5 * var(--tpl-base-size) + 108px)");
      await wrapper.get(id("language-back-default")).trigger("click");
      await measure(0);
      expect(top()).toBe("calc(3.5 * var(--tpl-base-size) + 0px)");
      wrapper.unmount();
      expect(observers.get(observed)!.disconnect).toHaveBeenCalledOnce();
    },
  );

  it("uses offsetHeight before the first observer entry inside a scaled host", async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetHeight",
    )!.get!;
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("tpl-top-chrome")
          ? ({ height: 27 } as DOMRect)
          : originalRect.call(this);
      });
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("tpl-top-chrome")
          ? 54
          : originalHeight.call(this);
      });
    onTestFinished(() => {
      rect.mockRestore();
      height.mockRestore();
    });
    const { wrapper } = await openLanguages();
    expect((wrapper.get(".tpl-body").element as HTMLElement).style.top).toBe(
      "calc(3.5 * var(--tpl-base-size) + 54px)",
    );
  });

  it("places version preview and the language bar in the same measured stack", async () => {
    const content = languageContent();
    const { wrapper, editor } = await openLanguages({
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
      versionHistory: {
        list: async () => ({
          versions: [{ id: "v1", createdAt: "2026-10-28T12:00:00Z", content }],
        }),
        get: async () => content,
        create: false,
        restore: false,
      },
    });
    await editor.load("bar-preview");
    await chooseLanguage(wrapper, "de");
    expect(wrapper.find(id("language-bar")).exists()).toBe(true);
    await wrapper.get(id("version-history-toggle")).trigger("click");
    await vi.dynamicImportSettled();
    await vi.waitFor(() =>
      expect(wrapper.find(id("version-history-entry")).exists()).toBe(true),
    );
    await wrapper.get(id("version-history-entry")).trigger("click");
    await vi.dynamicImportSettled();
    await vi.waitFor(() =>
      expect(wrapper.find(id("version-preview-banner")).exists()).toBe(true),
    );
    const bar = wrapper.get(id("language-bar")).element;
    const banner = wrapper.get(id("version-preview-banner")).element;
    expect(bar.parentElement).toBe(banner.parentElement);
    expect(banner.classList.contains("tpl:absolute")).toBe(false);
    expect(wrapper.get(".tpl-body").element.contains(bar)).toBe(false);
  });

  it.each([false, true])(
    "keeps language-view sidebar tabs usable with a selected block and versionPreview=%s",
    async (versionPreview) => {
      const content = languageContent();
      const { wrapper, editor } = await openLanguages({
        content,
        templates: {
          load: async (id) => ({ id, content }),
          create: false,
          save: false,
        },
        versionHistory: {
          list: async () => ({
            versions: [
              { id: "v1", createdAt: "2026-10-28T12:00:00Z", content },
            ],
          }),
          get: async () => content,
          create: false,
          restore: false,
        },
      });
      await editor.load("sidebar-tabs");
      await chooseLanguage(wrapper, "de");
      if (versionPreview) {
        await wrapper.get(id("version-history-toggle")).trigger("click");
        await vi.dynamicImportSettled();
        await vi.waitFor(() =>
          expect(wrapper.find(id("version-history-entry")).exists()).toBe(true),
        );
        await wrapper.get(id("version-history-entry")).trigger("click");
        await vi.dynamicImportSettled();
        expect(wrapper.find(id("version-preview-banner")).exists()).toBe(true);
      }
      editor.selectBlock("title");
      await nextTick();
      for (const tab of ["settings", "issues"]) {
        await wrapper.get(`#tpl-tab-${tab}`).trigger("click");
        expect(wrapper.get(`#tpl-tab-${tab}`).attributes("aria-selected")).toBe(
          "true",
        );
        expect(wrapper.find(`#tpl-tabpanel-${tab}`).exists()).toBe(true);
      }
      editor.selectBlock("image");
      await nextTick();
      expect(wrapper.get("#tpl-tab-content").attributes("aria-selected")).toBe(
        "true",
      );
    },
  );

  it("opens Content when another template reuses the selected block id", async () => {
    const { wrapper, editor } = await openLanguages({
      templates: {
        load: async (id) => ({ id, content: languageContent() }),
        create: false,
        save: false,
      },
    });
    await editor.load("first-template");
    await chooseLanguage(wrapper, "de");
    editor.selectBlock("title");
    await nextTick();
    await wrapper.get("#tpl-tab-settings").trigger("click");
    expect(wrapper.get("#tpl-tab-settings").attributes("aria-selected")).toBe(
      "true",
    );

    await editor.load("second-template");
    await nextTick();
    expect(editor.state.template?.id).toBe("second-template");
    expect(editor.selectedBlock.value?.id).toBe("title");
    expect(wrapper.get("#tpl-tab-content").attributes("aria-selected")).toBe(
      "true",
    );
  });

  it("shares the measured header-plus-stack inset with both sidebars and clears it in the default view", async () => {
    const observers = observeChrome();
    const { wrapper } = await openLanguages();
    await chooseLanguage(wrapper, "de");
    const chrome = wrapper.get(".tpl-top-chrome").element;
    const measure = async (height: number) => {
      vi.spyOn(chrome, "getBoundingClientRect").mockReturnValue({
        height,
      } as DOMRect);
      observers
        .get(chrome)!
        .callback([resizeEntry(chrome, height, true)], {} as ResizeObserver);
      await nextTick();
      for (const selector of [
        ".tpl-body",
        ".tpl-sidebar-rail",
        ".tpl-right-sidebar",
      ]) {
        expect((wrapper.get(selector).element as HTMLElement).style.top).toBe(
          `calc(3.5 * var(--tpl-base-size) + ${height}px)`,
        );
      }
    };
    await measure(54);
    await measure(108);
    await wrapper.get(id("language-back-default")).trigger("click");
    await measure(0);
  });
});
