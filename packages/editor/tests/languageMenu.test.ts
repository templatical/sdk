// @vitest-environment happy-dom
import { describe, expect, it, vi, onTestFinished } from "vitest";
import { createButtonBlock, createImageBlock } from "@templatical/types";
import AiChatPanel from "../src/components/ai/AiChatPanel.vue";
import en from "../src/i18n/locales/en";
import { TRANSLATIONS_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import { headerFeatures } from "./helpers/headerFeatures";
import EditorHeader from "../src/components/EditorHeader.vue";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import {
  openLanguages,
  chooseLanguage,
  languageContent,
} from "./helpers/localization";

describe("language menu", () => {
  it("bases the language-button cap on editor sizing with an 8px host root", async () => {
    const previous = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = "8px";
    try {
      const { wrapper } = await openLanguages();
      const button = wrapper.get('[data-testid="language-menu"]')
        .element as HTMLButtonElement;
      expect(button.style.maxWidth).not.toMatch(/rem/);
      expect(button.style.maxWidth).toContain("var(--tpl-base-size)");
    } finally {
      document.documentElement.style.fontSize = previous;
    }
  });

  it("shows native names, coverage, default and disabled versions and switches the display", async () => {
    const { wrapper, editor } = await openLanguages();
    const button = wrapper.get('[data-testid="language-menu"]');
    expect(button.attributes("aria-haspopup")).toBe("menu");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.text()).toContain("English");
    await button.trigger("click");
    expect(button.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="language-option-en"]').text()).toContain(
      "Default",
    );
    expect(wrapper.get('[data-testid="language-option-de"]').text()).toContain(
      "1 not translated",
    );
    expect(wrapper.get('[data-testid="language-option-de"]').text()).toContain(
      "1 out of date",
    );
    const disabled = wrapper.get('[data-testid="language-option-fr"]');
    expect(disabled.text()).toContain("Not enabled");
    expect(disabled.text()).toContain("2 not translated");
    expect(disabled.text()).toContain("0 out of date");
    await disabled.trigger("click");
    expect(editor.activeLocale.value).toBe("fr");
    const before = JSON.stringify(editor.content.value);
    editor.updateBlock("title", { content: "Refused" } as any);
    expect(JSON.stringify(editor.content.value)).toBe(before);
    await button.trigger("click");
    expect(wrapper.find('[data-testid="language-remove-de"]').exists()).toBe(
      false,
    );
    await wrapper.get('[data-testid="language-option-de"]').trigger("click");
    await nextTick();
    expect(editor.activeLocale.value).toBe("de");
    expect(button.text()).toContain("Deutsch");
    expect(button.text()).toContain("0/2");
    expect(wrapper.get(".tpl-canvas").text()).toContain("Hallo");
  });

  it("adds only missing enabled languages, confirms removal and supports undo", async () => {
    const { wrapper, editor, history } = await openLanguages();
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    expect(wrapper.find('[data-testid="language-add-de"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="language-add-en"]').exists()).toBe(
      false,
    );
    await wrapper.get('[data-testid="language-add-nl"]').trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["de", "fr", "nl"]);
    history.undo();
    await nextTick();
    expect(editor.content.value.settings.locales).toEqual(["de", "fr"]);
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de).toBeDefined();
    await wrapper
      .get('[data-testid="language-remove-cancel"]')
      .trigger("click");
    expect(editor.content.value.settings.locales).toContain("de");
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    await wrapper
      .get('[data-testid="language-remove-confirm"]')
      .trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["fr"]);
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
    history.undo();
    expect(editor.content.value.blocks[0].l10n?.de).toBeDefined();
  });

  it("falls back to the tag when Intl.DisplayNames is unavailable", async () => {
    const spy = vi.spyOn(Intl, "DisplayNames").mockImplementation(() => {
      throw new RangeError("unavailable");
    });
    try {
      const { wrapper } = await openLanguages();
      await chooseLanguage(wrapper, "de");
      expect(wrapper.get('[data-testid="language-menu"]').text()).toContain(
        "de",
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("has no language controls when localization is absent", async () => {
    const { wrapper } = await openLanguages({ localization: undefined });
    // A positive control prevents a missing menu implementation passing this test.
    const enabled = await openLanguages();
    expect(enabled.wrapper.find('[data-testid="language-menu"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="language-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid^="locale-marker-"]').exists()).toBe(
      false,
    );
  });

  it("keeps a long native name bounded in the left group and leaves centre controls interactive", async () => {
    const content = languageContent();
    content.settings.locales = ["de", "zh-Hant-HK"];
    const { wrapper: editorWrapper, editor } = await openLanguages({
      content,
      localization: { locales: ["de", "zh-Hant-HK"] },
    });
    const wrapper = mountEditor(EditorHeader, {
      props: {
        ...editorWrapper.findComponent(EditorHeader).props(),
        ...headerFeatures(),
        showTemplateName: true,
      } satisfies InstanceType<typeof EditorHeader>["$props"],
      provides: { [TRANSLATIONS_KEY]: en },
    });
    onTestFinished(() => wrapper.unmount());
    await vi.dynamicImportSettled();
    for (const id of [
      "version-history",
      "collaborator-bar",
      "comments-trigger",
      "ai-menu-trigger",
      "test-email-trigger",
      "template-save",
    ]) {
      expect(wrapper.get(`[data-testid="${id}"]`).isVisible()).toBe(true);
    }
    const centre = wrapper.get(".tpl-header-center").html();
    await chooseLanguage(wrapper, "zh-Hant-HK");
    const menu = wrapper.get('.tpl-header-left [data-testid="language-menu"]');
    expect(menu.attributes("style")).toContain("max-width");
    expect(wrapper.get(".tpl-header-center").html()).toBe(centre);
    await wrapper.get(".tpl-preview-toggle").trigger("click");
    expect(editor.state.previewMode).toBe(true);
  });

  it("shows the existing AI composer note and hides AI fixes and alt text after switching", async () => {
    const content = languageContent();
    content.blocks = [
      createButtonBlock({
        id: "button",
        text: "Click here",
        url: "https://example.com",
      }),
      createImageBlock({
        id: "image-one",
        src: "https://example.com/one.jpg",
        alt: "",
      }),
      createImageBlock({
        id: "image-two",
        src: "https://example.com/two.jpg",
        alt: "",
      }),
    ];
    const { wrapper, editor } = await openLanguages({
      content,
      templates: {
        load: async (id: string) => ({ id, content }),
        create: false,
        save: false,
      },
      ai: {
        chat: async () => {},
        fixFinding: async () => ({ messageId: null, text: "" }),
        altText: async () => ({ alt: "Image" }),
        rewrite: false,
        chatAttachments: false,
      } as any,
    });
    await editor.load("ai-language");
    await wrapper.get("#tpl-tab-issues").trigger("click");
    await vi.dynamicImportSettled();
    const selectors = [
      "issue-ai-fix",
      "issue-ai-alt-text",
      "issue-ai-alt-text-bulk",
    ];
    await vi.waitFor(() => {
      for (const id of selectors)
        expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
    });
    await chooseLanguage(wrapper, "de");
    for (const id of selectors)
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.get('[data-testid="ai-default-language"]').text()).toBe(
      "AI chat edits the default language.",
    );
    const feature = wrapper.getComponent(AiChatPanel).props("feature");
    expect(feature.has("fixFinding")).toBe(false);
    expect(feature.has("altText")).toBe(false);
    await chooseLanguage(wrapper, "en");
    await vi.waitFor(() => {
      for (const id of selectors)
        expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
    });
  });
});
