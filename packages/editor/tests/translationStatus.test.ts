// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { mount } from "@vue/test-utils";
import TranslationStatus from "../src/components/localization/TranslationStatus.vue";
import type { TranslationRunResult } from "../src/composables/useTranslationFeature";
import en from "../src/i18n/locales/en";
import { TRANSLATIONS_KEY } from "../src/keys";
import { openLanguages, chooseLanguage } from "./helpers/localization";

describe("translation status", () => {
  it("announces progress, cancels, and dismisses the partial-result notice in the real editor", async () => {
    const { wrapper } = await openLanguages({
      translation: { translate: async () => new Promise(() => {}) },
    });
    await chooseLanguage(wrapper, "de");
    await wrapper.get('[data-testid="locale-translate"]').trigger("click");
    expect(wrapper.find('[data-testid="translation-status"]').exists()).toBe(
      true,
    );
    const status = wrapper.get('[data-testid="translation-status"]');
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toContain("Translating 0 of 1…");
    await wrapper.get('[data-testid="translation-cancel"]').trigger("click");
    await vi.waitFor(() =>
      expect(
        wrapper.get('[data-testid="translation-result"]').text(),
      ).toContain("Translated 0 fields"),
    );
    await wrapper.get('[data-testid="translation-dismiss"]').trigger("click");
    expect(wrapper.find('[data-testid="translation-status"]').exists()).toBe(
      false,
    );
  });

  it("renders every result part and the provider's error message", () => {
    const lastResult = ref<TranslationRunResult | null>({
      translated: 38,
      tagsChanged: ["a", "b"],
      skippedLocked: ["c", "d", "e"],
      missing: ["f"],
      error: { code: "rate_limited", message: "Try later" },
      cancelled: false,
    });
    const wrapper = mount(TranslationStatus, {
      props: {
        feature: {
          isAvailable: computed(() => true),
          counts: computed(() => ({ gaps: 0, all: 0 })),
          running: ref(null),
          lastResult,
          translate: async () => lastResult.value!,
          cancel: () => {},
          dismissResult: () => {
            lastResult.value = null;
          },
        },
        locale: "de",
      },
      global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
    });
    try {
      expect(wrapper.find('[data-testid="translation-result"]').exists()).toBe(
        true,
      );
      const text = wrapper.get('[data-testid="translation-result"]').text();
      for (const part of [
        "Translated 38 fields",
        "2 kept their old text: tags changed",
        "3 skipped: being edited in Deutsch",
        "1 not returned",
        "Try later",
      ])
        expect(text).toContain(part);
    } finally {
      wrapper.unmount();
    }
  });
});
