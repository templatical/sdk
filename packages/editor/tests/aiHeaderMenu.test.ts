// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import AiHeaderMenu from "../src/components/ai/AiHeaderMenu.vue";
import { loadTranslations } from "../src/i18n";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

async function setup(features: string[], available = true) {
  const panel = ref<"chat" | null>(null);
  const ai = {
    panel,
    isAvailable: ref(available),
    has: (name: string) => features.includes(name),
    open: vi.fn((value: "chat") => (panel.value = value)),
    close: vi.fn(() => (panel.value = null)),
  };
  const wrapper = mountEditor(AiHeaderMenu, {
    props: { feature: ai },
    provides: { [TRANSLATIONS_KEY]: await loadTranslations("en") },
  });
  return { ai, wrapper };
}

describe("AiHeaderMenu", () => {
  it("opens chat on a click and closes it on the next click", async () => {
    const { ai, wrapper } = await setup(["chat"]);
    const button = wrapper.get('[data-testid="ai-menu-trigger"]');

    await button.trigger("click");
    expect(ai.open).toHaveBeenCalledExactlyOnceWith("chat");
    expect(ai.close).not.toHaveBeenCalled();

    await button.trigger("click");
    expect(ai.close).toHaveBeenCalledOnce();
    expect(ai.open).toHaveBeenCalledOnce();
  });

  it("reflects the panel state with aria-pressed and its active style", async () => {
    const { ai, wrapper } = await setup(["chat"]);
    const button = wrapper.get('[data-testid="ai-menu-trigger"]');
    expect(button.text()).toBe("AI");
    expect(button.attributes("aria-label")).toBe("AI assistant");
    expect(button.attributes("title")).toBe("AI assistant");
    expect(button.attributes("aria-expanded")).toBeUndefined();
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.classes()).toContain("tpl-ai-btn--idle");

    await button.trigger("click");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(button.classes()).toContain("tpl-ai-btn--active");

    ai.close();
    await nextTick();
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.classes()).toContain("tpl-ai-btn--idle");
  });

  it.each([
    { features: [] },
    { features: ["chatAttachments"] },
    { features: ["rewrite", "fixFinding", "altText"] },
  ])("hides the button without chat ($features)", async ({ features }) => {
    const { wrapper } = await setup(features);
    expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
      false,
    );
  });

  it("hides the button while unavailable", async () => {
    const { wrapper } = await setup(["chat"], false);
    expect(wrapper.find('[data-testid="ai-menu-trigger"]').exists()).toBe(
      false,
    );
  });

  it("renders only the toggle with no menu items or file input", async () => {
    const { wrapper } = await setup(["chat", "chatAttachments"]);
    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(wrapper.find('[role="menuitem"]').exists()).toBe(false);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
});
