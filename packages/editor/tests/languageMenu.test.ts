// @vitest-environment happy-dom
import { describe, expect, it, vi, onTestFinished } from "vitest";
import {
  createButtonBlock,
  createImageBlock,
  createTitleBlock,
  sourceHash,
} from "@templatical/types";
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
  it("names the wide trigger with its visible count before the gap breakdown and keeps the tag", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    const trigger = wrapper.get('[data-testid="language-menu"]');
    expect(trigger.get(".tpl-language-name").text()).toBe("Deutsch");
    expect(trigger.get(".tpl-language-count").text()).toBe("2");
    expect(trigger.attributes("aria-label")).toBe(
      "Deutsch 2 (de), 1 missing, 1 out of date",
    );
    editor.keepTranslations("title", ["content"]);
    editor.updateBlock("image", { alt: "Produkt" });
    await nextTick();
    expect(trigger.find(".tpl-language-count").exists()).toBe(false);
    expect(trigger.attributes("aria-label")).toBe("Deutsch (de)");
  });

  it("names the trigger with the language and the tag the compact header shows", async () => {
    const content = languageContent();
    content.settings.locales = ["de", "nl", "ja"];
    const { wrapper, editor } = await openLanguages({
      content,
      localization: { locales: ["de", "nl", "ja"] },
    });
    const trigger = () => wrapper.get('[data-testid="language-menu"]');
    expect(trigger().attributes("aria-label")).toBe("English (en)");
    for (const [tag, name] of [
      ["de", "Deutsch 2 (de), 1 missing, 1 out of date"],
      ["nl", "Nederlands 2 (nl), 2 missing, 0 out of date"],
      ["ja", "日本語 2 (ja), 2 missing, 0 out of date"],
    ]) {
      editor.setActiveLocale(tag);
      await nextTick();
      // Both renderings of the trigger are inside its accessible name.
      expect(trigger().attributes("aria-label")).toBe(name);
      expect(name).toContain(trigger().get(".tpl-language-name").text());
      expect(name).toContain(trigger().get(".tpl-language-tag").text());
    }
  });

  it("keeps promotion reasons unique and stable across two light-DOM editors", async () => {
    const content = languageContent();
    content.blocks[0].l10n!.de.hidden = true;
    const one = await openLanguages({ content });
    const two = await openLanguages({ content: structuredClone(content) });
    const ids: string[] = [];
    for (const { wrapper } of [one, two]) {
      await wrapper.get('[data-testid="language-menu"]').trigger("click");
      await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
      const action = wrapper.get('[data-testid="language-make-default-de"]');
      const id = action.attributes("aria-describedby");
      ids.push(id);
      expect(wrapper.get(`#${id}`).text()).toBeTruthy();
      await wrapper
        .get('[data-testid="language-menu"]')
        .trigger("keydown", { key: "Escape" });
      await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
      expect(
        wrapper
          .get('[data-testid="language-make-default-de"]')
          .attributes("aria-describedby"),
      ).toBe(id);
    }
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids)
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
    // Both editors' status-chip popovers open at once (by keyboard, which an
    // outside click in the other editor doesn't close).
    const popovers: string[] = [];
    for (const { wrapper, editor } of [one, two]) {
      editor.setActiveLocale("de");
      await nextTick();
      const chip = wrapper.get(
        '[data-block-id="image"] [data-testid="locale-chip"]',
      );
      await chip.trigger("keydown", { key: "Enter" });
      const id = wrapper
        .get('[data-testid="locale-popover"]')
        .attributes("id")!;
      expect(chip.attributes("aria-controls")).toBe(id);
      popovers.push(id);
    }
    expect(popovers[0]).not.toBe(popovers[1]);
    for (const id of popovers)
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
  });

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
      "1 missing · 1 out of date",
    );
    expect(wrapper.get('[data-testid="language-option-de"]').text()).toContain(
      "1 out of date",
    );
    const disabled = wrapper.get('[data-testid="language-option-fr"]');
    expect(disabled.text()).toContain("Not enabled");
    expect(disabled.text()).toContain("2 missing");
    expect(disabled.text()).not.toContain("0 out of date");
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
    expect(button.text()).toContain("2");
    expect(button.attributes("title")).toBe("1 missing, 1 out of date");
    expect(button.find(".lucide-triangle-alert").exists()).toBe(true);
    expect(button.text()).not.toContain("/");
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
    await wrapper.get('[data-testid="language-add"]').trigger("click");
    await wrapper.get('[data-testid="language-add-nl"]').trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["de", "fr", "nl"]);
    history.undo();
    await nextTick();
    expect(editor.content.value.settings.locales).toEqual(["de", "fr"]);
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de).toBeDefined();
    await wrapper
      .get('[data-testid="language-remove-cancel"]')
      .trigger("click");
    expect(editor.content.value.settings.locales).toContain("de");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    await wrapper
      .get('[data-testid="language-remove-confirm"]')
      .trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["fr"]);
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
    history.undo();
    expect(editor.content.value.blocks[0].l10n?.de).toBeDefined();
  });

  it("orders radio rows, marks only the active row and keeps actions behind the submenu", async () => {
    const { wrapper } = await openLanguages();
    await chooseLanguage(wrapper, "de");
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    const rows = wrapper.findAll('[role="menuitemradio"]');
    expect(rows.map((row) => row.attributes("data-testid"))).toEqual([
      "language-option-en",
      "language-option-de",
      "language-option-fr",
    ]);
    expect(rows.map((row) => row.attributes("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(rows.map((row) => row.find(".lucide-check").exists())).toEqual([
      false,
      true,
      false,
    ]);
    expect(rows[1].element.parentElement?.getAttribute("data-active")).toBe(
      "true",
    );
    expect(rows[1].classes()).toContain("tpl:bg-transparent");
    expect(wrapper.find('[data-testid="language-status-en"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="language-remove-de"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="language-actions-fr"]').exists()).toBe(
      false,
    );
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    expect(wrapper.get('[data-testid="language-make-default-de"]').text()).toBe(
      "Make default language",
    );
    expect(wrapper.get('[data-testid="language-remove-de"]').text()).toBe(
      "Remove Deutsch…",
    );
    expect(
      wrapper.get('[data-testid="language-remove-de"]').classes(),
    ).not.toContain("tpl:text-[var(--tpl-text)]");
  });

  it("omits zero counts and shows Complete with an icon", async () => {
    const content = languageContent();
    content.blocks = Array.from({ length: 5 }, (_, i) =>
      createTitleBlock({ id: `t${i}`, content: "Hello" }),
    );
    const { wrapper, editor } = await openLanguages({ content });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    expect(wrapper.get('[data-testid="language-status-de"]').text()).toBe(
      "5 missing",
    );
    for (const block of editor.content.value.blocks)
      block.l10n = {
        de: {
          text: {
            content: { value: "Hallo", sourceHash: sourceHash("Hello") },
          },
        },
      };
    await nextTick();
    const status = wrapper.get('[data-testid="language-status-de"]');
    expect(status.text()).toBe("Complete");
    expect(status.find(".lucide-check").exists()).toBe(true);
  });

  it("disables promotion until hidden blocks are shown", async () => {
    const content = languageContent();
    content.blocks.forEach((block) => {
      block.l10n = { de: { hidden: true } };
    });
    const { wrapper } = await openLanguages({ content });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    const action = wrapper.get('[data-testid="language-make-default-de"]');
    expect(action.attributes("aria-disabled")).toBe("true");
    expect(action.attributes("disabled")).toBeUndefined();
    expect(
      wrapper.get(`#${action.attributes("aria-describedby")}`).text(),
    ).toBe("Show the 2 blocks hidden in Deutsch first");
    await action.trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("disables promotion while the current default isn't an enabled language", async () => {
    const { wrapper, editor, history } = await openLanguages({
      localization: { locales: ["de", "nl"] },
    });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    const action = wrapper.get('[data-testid="language-make-default-de"]');
    expect(action.attributes("aria-disabled")).toBe("true");
    expect(action.attributes("disabled")).toBeUndefined();
    const reason = wrapper.get(`#${action.attributes("aria-describedby")}`);
    expect(reason.text()).toBe("Add English to the enabled languages first");
    expect(action.text()).toContain(reason.text());
    await action.trigger("click");
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(editor.content.value.settings.locale).toBe("en");
    expect(history.canUndo.value).toBe(false);
  });

  it("names the enabling reason ahead of hidden blocks", async () => {
    const content = languageContent();
    content.blocks[0].l10n!.de.hidden = true;
    const { wrapper } = await openLanguages({
      content,
      localization: { locales: ["de", "nl"] },
    });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    const action = wrapper.get('[data-testid="language-make-default-de"]');
    expect(action.attributes("aria-disabled")).toBe("true");
    expect(
      wrapper.get(`#${action.attributes("aria-describedby")}`).text(),
    ).toBe("Add English to the enabled languages first");
  });

  it("enables promotion when the current default is an enabled language", async () => {
    const { wrapper } = await openLanguages({
      localization: { locales: ["en", "de", "nl"] },
    });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    const action = wrapper.get('[data-testid="language-make-default-de"]');
    expect(action.attributes("aria-disabled")).toBe("false");
    expect(action.attributes("aria-describedby")).toBeUndefined();
    await action.trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "Make Deutsch the default language?",
    );
  });

  it("promotes with the pre-operation gap count, keeping stale text and set overrides out of it", async () => {
    const content = languageContent();
    content.blocks.push(
      createTitleBlock({
        id: "override",
        content: "Base",
        l10n: { de: { set: { content: "Override" } } },
      }),
    );
    const { wrapper, editor, history } = await openLanguages({ content });
    const before = JSON.stringify(editor.content.value);
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    const action = wrapper.get('[data-testid="language-make-default-de"]');
    expect(action.attributes("disabled")).toBeUndefined();
    await action.trigger("click");
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain("Make Deutsch the default language?");
    expect(dialog.text()).toContain(
      "1 field has no Deutsch text and keeps its English text.",
    );
    await wrapper
      .get('[data-testid="language-default-confirm"]')
      .trigger("click");
    expect(editor.content.value.settings.locale).toBe("de");
    expect(editor.activeLocale.value).toBeNull();
    history.undo();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("omits the zero-gap paragraph and cancels promotion without changes", async () => {
    const content = languageContent();
    content.blocks = [content.blocks[0]];
    const { wrapper, editor } = await openLanguages({ content });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    await wrapper
      .get('[data-testid="language-make-default-de"]')
      .trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).not.toContain("keeps");
    await wrapper
      .get('[data-testid="language-default-cancel"]')
      .trigger("click");
    expect(editor.content.value.settings.locale).toBe("en");
  });

  it("uses the danger confirmation and explanatory copy for removal", async () => {
    const { wrapper, editor } = await openLanguages();
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    await wrapper.get('[data-testid="language-remove-de"]').trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain("Remove Deutsch?");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "This deletes the Deutsch text and changes. You can undo it.",
    );
    const confirm = wrapper.get('[data-testid="language-remove-confirm"]');
    expect(confirm.classes()).toContain("tpl:border-[var(--tpl-danger)]");
    await confirm.trigger("click");
    expect(editor.content.value.settings.locales).toEqual(["fr"]);
  });

  it("hides Add language when every configured language is present", async () => {
    const available = await openLanguages();
    await available.wrapper
      .get('[data-testid="language-menu"]')
      .trigger("click");
    expect(
      available.wrapper.find('[data-testid="language-add"]').exists(),
    ).toBe(true);
    const { wrapper } = await openLanguages({
      localization: { locales: ["en", "de", "fr"] },
    });
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    expect(wrapper.find('[data-testid="language-add"]').exists()).toBe(false);
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
    expect(wrapper.find('[data-testid="locale-chip"]').exists()).toBe(false);
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

  it("shows the active-language AI composer note and keeps AI fixes and alt text after switching", async () => {
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
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
    await wrapper.get('[data-testid="ai-menu-trigger"]').trigger("click");
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(wrapper.get('[data-testid="ai-active-language"]').text()).toBe(
      "AI chat edits Deutsch. Structure changes apply to every language.",
    );
    const feature = wrapper.getComponent(AiChatPanel).props("feature");
    expect(feature.has("fixFinding")).toBe(true);
    expect(feature.has("altText")).toBe(true);
    await chooseLanguage(wrapper, "en");
    await vi.waitFor(() => {
      for (const id of selectors)
        expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(true);
    });
  });
});
