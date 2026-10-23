// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import AiHeaderMenu from "../src/components/ai/AiHeaderMenu.vue";
import { loadTranslations } from "../src/i18n";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
function feature(features: string[]) {
  return {
    panel: ref<"chat" | null>(null),
    isAvailable: computed(() => true),
    has: (name: string) => features.includes(name),
    open: vi.fn(),
    close: vi.fn(),
    startImport: vi.fn(),
  };
}
async function setup(features: string[]) {
  const ai = feature(features);
  const wrapper = mountEditor(AiHeaderMenu, {
    props: { feature: ai },
    provides: { [TRANSLATIONS_KEY]: await loadTranslations("en") },
  });
  await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
  return { ai, wrapper };
}
describe("AiHeaderMenu", () => {
  it("lists chat and import and clicks its picker synchronously before opening chat", async () => {
    const { ai, wrapper } = await setup(["chat", "chatAttachments"]);
    expect(
      wrapper
        .findAll('[data-testid^="ai-menu-item-"]')
        .map((item) => item.attributes("data-testid")),
    ).toEqual(["ai-menu-item-chat", "ai-menu-item-import"]);
    expect(wrapper.get('[data-testid="ai-menu-item-import"]').text()).toContain(
      "Import from screenshot or PDF",
    );
    const input = wrapper.get('input[type="file"]');
    const click = vi.spyOn(input.element as HTMLInputElement, "click");
    (
      wrapper.get('[data-testid="ai-menu-item-import"]')
        .element as HTMLButtonElement
    ).click();
    expect(click).toHaveBeenCalledOnce();
    expect(ai.open).not.toHaveBeenCalled();
    expect(ai.startImport).not.toHaveBeenCalled();
    const files = [new File(["x"], "ref.png", { type: "image/png" })];
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: files,
    });
    await input.trigger("change");
    expect(ai.startImport).toHaveBeenCalledExactlyOnceWith(files);
    Object.defineProperty(input.element, "files", { value: [] });
    await input.trigger("change");
    expect(ai.startImport).toHaveBeenCalledOnce();
  });
  it("opens chat and closes it when chosen again", async () => {
    const { ai, wrapper } = await setup(["chat"]);
    await wrapper.get('[data-testid="ai-menu-item-chat"]').trigger("click");
    expect(ai.open).toHaveBeenCalledWith("chat");
    ai.panel.value = "chat";
    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    await wrapper.get('[data-testid="ai-menu-item-chat"]').trigger("click");
    expect(ai.close).toHaveBeenCalled();
  });
  it("hides import without attachment support", async () => {
    const { wrapper } = await setup(["chat"]);
    expect(wrapper.find('[data-testid="ai-menu-item-import"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
  });
});
