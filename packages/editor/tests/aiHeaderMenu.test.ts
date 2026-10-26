// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import AiHeaderMenu from "../src/components/ai/AiHeaderMenu.vue";
import EditorHeader from "../src/components/EditorHeader.vue";
import { loadTranslations } from "../src/i18n";
import { secondaryBtnCompactClass } from "../src/constants/styleConstants";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function aiFeature(features: string[], available = true) {
  const panel = ref<"chat" | null>(null);
  return {
    panel,
    isAvailable: ref(available),
    has: (name: string) => features.includes(name),
    open: vi.fn((value: "chat") => (panel.value = value)),
    close: vi.fn(() => (panel.value = null)),
  };
}

async function setup(features: string[], available = true) {
  const ai = aiFeature(features, available);
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
    const el = button.element as HTMLButtonElement;
    expect(button.text()).toBe("AI");
    expect(button.attributes("aria-label")).toBe("AI assistant");
    expect(button.attributes("title")).toBe("AI assistant");
    expect(button.attributes("aria-expanded")).toBeUndefined();
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(el.style.backgroundColor).toBe("");

    await button.trigger("click");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(el.style.backgroundColor).toBe("var(--tpl-primary-light)");
    expect(el.style.borderColor).toBe("var(--tpl-primary-light)");

    ai.close();
    await nextTick();
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(el.style.backgroundColor).toBe("");
  });

  it("wears the header's compact secondary recipe with the amber on its icon only", async () => {
    const { wrapper } = await setup(["chat"]);
    const button = wrapper.get('[data-testid="ai-menu-trigger"]');
    expect(button.classes().sort()).toEqual(
      secondaryBtnCompactClass.split(" ").sort(),
    );
    expect(button.get("svg").classes()).toContain(
      "tpl:text-[var(--tpl-primary-hover)]",
    );
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

describe("EditorHeader's AI button", () => {
  it("renders in the same pass as the other header controls", async () => {
    // A template is loaded: comments and AI are both available. A lazily
    // loaded button renders a placeholder first and pops in one chunk fetch
    // later (OI-245), so nothing may be awaited between mount and the reads.
    const t = await loadTranslations("en");
    const wrapper = mountEditor(EditorHeader, {
      props: {
        editor: {
          state: {
            viewport: "desktop",
            darkMode: false,
            previewMode: false,
            isDirty: false,
          },
          setViewport: vi.fn(),
          setDarkMode: vi.fn(),
          setPreviewMode: vi.fn(),
        },
        core: { t },
        templates: null,
        showTemplateName: false,
        testEmail: null,
        versionHistory: null,
        comments: {
          isAvailable: ref(true),
          hasTemplate: ref(true),
          unresolvedCount: ref(0),
          isOpen: ref(false),
          toggle: vi.fn(),
        },
        collaboration: null,
        ai: aiFeature(["chat"]),
      } as never,
      provides: { [TRANSLATIONS_KEY]: t },
    });

    const comments = wrapper.find('[data-testid="comments-trigger"]');
    const ai = wrapper.find('[data-testid="ai-menu-trigger"]');
    expect(comments.exists()).toBe(true);
    expect(ai.exists()).toBe(true);
    expect(comments.element.nextElementSibling).toBe(ai.element);
    expect(ai.classes()).toEqual(comments.classes());
  });
});
