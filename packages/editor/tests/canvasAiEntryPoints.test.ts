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
  it("offers chat and import, opening the picker synchronously before chat", async () => {
    const open = vi.fn(),
      startImport = vi.fn();
    const wrapper = await mountCanvas({
      isFeatureEnabled: (feature: string) =>
        feature === "chat" || feature === "chatAttachments",
      open,
      startImport,
      highlightOf: () => null,
    });
    await wrapper.get('[data-testid="canvas-ai-chat"]').trigger("click");
    expect(open.mock.calls).toEqual([["chat"]]);
    const input = wrapper.get('input[type="file"]');
    const click = vi.spyOn(input.element as HTMLInputElement, "click");
    (
      wrapper.get('[data-testid="canvas-ai-import"]')
        .element as HTMLButtonElement
    ).click();
    expect(click).toHaveBeenCalledOnce();
    expect(startImport).not.toHaveBeenCalled();
    const files = [new File(["x"], "ref.pdf", { type: "application/pdf" })];
    Object.defineProperty(input.element, "files", {
      configurable: true,
      value: files,
    });
    await input.trigger("change");
    expect(startImport).toHaveBeenCalledExactlyOnceWith(files);
    Object.defineProperty(input.element, "files", { value: [] });
    await input.trigger("change");
    expect(startImport).toHaveBeenCalledOnce();
  });
  it("hides import when chat attachments are disabled", async () => {
    const wrapper = await mountCanvas({
      isFeatureEnabled: (feature: string) => feature === "chat",
      open: vi.fn(),
      highlightOf: () => null,
    });
    expect(wrapper.find('[data-testid="canvas-ai-import"]').exists()).toBe(
      false,
    );
  });

  it("shows neither without an AI provider", async () => {
    const wrapper = await mountCanvas(null);
    expect(wrapper.find('[data-testid="canvas-ai-chat"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="canvas-ai-import"]').exists()).toBe(
      false,
    );
  });
});
