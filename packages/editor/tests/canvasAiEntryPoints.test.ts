// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import Canvas from "../src/components/Canvas.vue";
import { loadTranslations } from "../src/i18n";
import { CAPABILITIES_KEY, EDITOR_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

async function mountCanvas(ai: unknown) {
  return mountEditor(Canvas, {
    props: {
      viewport: "desktop",
      content: { blocks: [], settings: { width: 600 } },
      selectedBlockId: null,
      darkMode: false,
      previewMode: false,
    },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations("en"),
      [CAPABILITIES_KEY]: ai ? { ai } : {},
      [EDITOR_KEY]: {
        state: { selectedBlockId: null },
        content: { value: { blocks: [] } },
      },
    },
  });
}

describe("the empty canvas's AI shortcuts (D17)", () => {
  it("offers chat and design when the provider has them, and opens them", async () => {
    const open = vi.fn();
    const wrapper = await mountCanvas({
      isFeatureEnabled: (feature: string) =>
        feature === "chat" || feature === "design",
      open,
      highlightOf: () => null,
    });

    await wrapper.get('[data-testid="canvas-ai-chat"]').trigger("click");
    await wrapper.get('[data-testid="canvas-ai-design"]').trigger("click");

    expect(open.mock.calls).toEqual([["chat"], ["design"]]);
  });

  it("shows neither without an AI provider", async () => {
    const wrapper = await mountCanvas(null);
    expect(wrapper.find('[data-testid="canvas-ai-chat"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="canvas-ai-design"]').exists()).toBe(
      false,
    );
  });
});
