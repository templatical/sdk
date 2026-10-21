// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import AiHeaderMenu from "../src/components/ai/AiHeaderMenu.vue";
import { loadTranslations } from "../src/i18n";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function feature(features: string[]) {
  return {
    panel: ref(null),
    isAvailable: computed(() => true),
    has: (name: string) => features.includes(name),
    open: vi.fn(),
    close: vi.fn(),
  };
}

describe("AiHeaderMenu", () => {
  it("lists the features the provider offers, and opens one", async () => {
    const ai = feature(["chat", "score"]);
    const wrapper = mountEditor(AiHeaderMenu, {
      props: { feature: ai },
      provides: { [TRANSLATIONS_KEY]: await loadTranslations("en") },
    });

    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    const items = wrapper.findAll('[data-testid^="ai-menu-item-"]');
    expect(items.map((item) => item.attributes("data-testid"))).toEqual([
      "ai-menu-item-chat",
      "ai-menu-item-scoring",
    ]);

    await items[1].trigger("click");
    expect(ai.open).toHaveBeenCalledWith("scoring");
  });

  it("closes the open panel when its item is chosen again", async () => {
    const ai = feature(["design"]);
    ai.panel.value = "design" as never;
    const wrapper = mountEditor(AiHeaderMenu, {
      props: { feature: ai },
      provides: { [TRANSLATIONS_KEY]: await loadTranslations("en") },
    });

    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    await wrapper.get('[data-testid="ai-menu-item-design"]').trigger("click");
    expect(ai.close).toHaveBeenCalled();
  });
});
