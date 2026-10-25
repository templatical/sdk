// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createMenuBlock, applyOperations } from "@templatical/types";
import { openLanguages, languageContent } from "./helpers/localization";

const block = (id: string) => `[data-block-id="${id}"]`;
describe("locale markers", () => {
  it("ignores an orphan whole-element override and still marks an absent optional object property", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [
          { id: "gone", text: "Gone", url: "https://example.com" },
          { id: "kept", text: "Kept", url: "https://example.com" },
        ],
      }),
    ];
    const localized = applyOperations(content, [
      {
        op: "updateBlockLocale",
        blockId: "menu",
        locale: "de",
        set: {
          "items.gone": {
            id: "gone",
            text: "Anders",
            url: "https://example.de",
          },
        },
      },
    ]);
    const { wrapper, editor } = await openLanguages({ content: localized });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.find('[data-testid="locale-marker-differs"]').exists()).toBe(
      true,
    );
    editor.setActiveLocale(null);
    editor.updateBlock("menu", {
      items: [{ id: "kept", text: "Kept", url: "https://example.com" }],
    });
    expect(
      editor.content.value.blocks[0].l10n?.de.set?.["items.gone"],
    ).toBeDefined();
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.find('[data-testid="locale-marker-differs"]').exists()).toBe(
      false,
    );
    editor.updateBlock("menu", { color: "#123456" });
    await nextTick();
    expect(
      wrapper.get('[data-testid="locale-marker-differs"]').text(),
    ).toContain("Differs in Deutsch");
    expect(editor.content.value.blocks[0]).not.toHaveProperty("color");
  });

  it("shows missing text and stale text with Keep updating the source hash", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    expect(
      wrapper
        .get(`${block("image")} [data-testid="locale-marker-untranslated"]`)
        .text(),
    ).toBe("Not translated");
    expect(
      wrapper
        .get(`${block("title")} [data-testid="locale-marker-stale"]`)
        .text(),
    ).toContain("Out of date");
    await wrapper
      .get(`${block("title")} [data-testid="locale-keep"]`)
      .trigger("click");
    expect(wrapper.find('[data-testid="locale-marker-stale"]').exists()).toBe(
      false,
    );
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "Hallo",
    );
  });
  it("uses default only for stale paths and resets only set paths", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await nextTick();
    await wrapper.get('[data-testid="locale-use-default"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de).toEqual({
      set: { color: "#123456" },
    });
    expect(
      wrapper.get('[data-testid="locale-marker-differs"]').text(),
    ).toContain("Differs in Deutsch");
    await wrapper.get('[data-testid="locale-reset"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
  });
  it("keeps hidden blocks as ghosts with Show and excludes them in preview", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.setBlockHidden("title", true);
    await nextTick();
    expect(wrapper.get(block("title")).classes()).toContain(
      "tpl-block--locale-hidden",
    );
    expect(
      wrapper.get('[data-testid="locale-marker-hidden"]').text(),
    ).toContain("Hidden in Deutsch");
    editor.setPreviewMode(true);
    await nextTick();
    expect(wrapper.find(block("title")).exists()).toBe(false);
    editor.setPreviewMode(false);
    await nextTick();
    await wrapper.get('[data-testid="locale-show"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.hidden).toBeUndefined();
    expect(wrapper.get(block("title")).classes()).not.toContain(
      "tpl-block--locale-hidden",
    );
  });
  it("counts stale fields across languages in the default view", async () => {
    const { wrapper } = await openLanguages();
    expect(wrapper.get('[data-testid="locale-marker-stale"]').text()).toBe(
      "Translations out of date: 1",
    );
    expect(wrapper.find('[data-testid="locale-keep"]').exists()).toBe(false);
  });
  it("hides a block through the visibility control in a language view", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.selectBlock("title");
    await nextTick();
    await vi.dynamicImportSettled();
    await wrapper.get('[data-testid="locale-hide"]').trigger("click");
    expect(editor.content.value.blocks[0].l10n?.de.hidden).toBe(true);
    expect(editor.content.value.blocks[0].visibility).toBeUndefined();
  });
  it("does not mark fields whose element ids contain dots", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [{ id: "bad.id", text: "Hello", url: "" }] as any,
      }),
    ];
    content.blocks[0].l10n = { de: { set: { "items.bad.id.text": "Hallo" } } };
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    // A normal missing field proves marker rendering has been implemented.
    editor.addBlock(languageContent().blocks[1]);
    await nextTick();
    expect(
      wrapper.find('[data-testid="locale-marker-untranslated"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .get(block("menu"))
        .find('[data-testid^="locale-marker-"]')
        .exists(),
    ).toBe(false);
  });
});
