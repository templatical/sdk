// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { nextTick } from "vue";
import {
  createCustomBlock,
  createTitleBlock,
  sourceHash,
  type CustomBlockDefinition,
} from "@templatical/types";
import {
  chooseLanguage,
  languageContent,
  openLanguages,
} from "./helpers/localization";

it("keeps English current after Make default and preserves its text after a German edit", async () => {
  const content = languageContent();
  content.blocks = [createTitleBlock({ id: "copy", content: "English copy" })];
  const { wrapper, editor, history } = await openLanguages({ content });
  const before = JSON.stringify(editor.content.value);
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
  await wrapper
    .get('[data-testid="language-make-default-de"]')
    .trigger("click");
  await wrapper
    .get('[data-testid="language-default-confirm"]')
    .trigger("click");
  expect(editor.content.value.settings.locale).toBe("de");
  expect(editor.activeLocale.value).toBeNull();
  expect(editor.content.value.blocks[0]).toMatchObject({
    content: "English copy",
    l10n: {
      en: {
        text: {
          content: {
            value: "English copy",
            sourceHash: sourceHash("English copy"),
          },
        },
      },
    },
  });
  await chooseLanguage(wrapper, "en");
  expect(wrapper.get(".tpl-canvas").text()).toContain("English copy");
  expect(
    wrapper.get('[data-testid="language-menu"]').attributes("title"),
  ).not.toContain("missing");
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  expect(wrapper.get('[data-testid="language-status-en"]').text()).toBe(
    "Complete",
  );
  await wrapper.get('[data-testid="language-option-de"]').trigger("click");
  history.undo();
  expect(JSON.stringify(editor.content.value)).toBe(before);
  expect(history.canUndo.value).toBe(false);
  history.redo();
  expect(editor.content.value.blocks[0].l10n?.en.text?.content.value).toBe(
    "English copy",
  );
  editor.updateBlock("copy", { content: "Deutscher Text" });
  await nextTick();
  await chooseLanguage(wrapper, "en");
  expect(wrapper.get(".tpl-canvas").text()).toContain("English copy");
  expect(wrapper.get('[data-testid="language-menu"]').attributes("title")).toBe(
    "0 missing, 1 out of date",
  );
});

it("keeps registered custom text and textarea current through the Make-default component flow", async () => {
  const definition: CustomBlockDefinition = {
    type: "card",
    name: "Card",
    template: "<p>{{ headline }}</p><p>{{ body }}</p>",
    fields: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
      { key: "color", label: "Color", type: "color" },
    ],
  };
  const content = languageContent();
  content.blocks = [
    {
      ...createCustomBlock(definition),
      id: "custom",
      fieldValues: {
        headline: "English title",
        body: "English body",
        color: "#123456",
      },
    },
  ];
  const { wrapper, editor, history } = await openLanguages({
    content,
    customBlocks: [definition],
  });
  const before = JSON.stringify(editor.content.value);
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
  await wrapper
    .get('[data-testid="language-make-default-de"]')
    .trigger("click");
  await wrapper
    .get('[data-testid="language-default-confirm"]')
    .trigger("click");
  expect(editor.content.value.blocks[0].l10n?.en.text).toEqual({
    "fieldValues.headline": {
      value: "English title",
      sourceHash: sourceHash("English title"),
    },
    "fieldValues.body": {
      value: "English body",
      sourceHash: sourceHash("English body"),
    },
  });
  await chooseLanguage(wrapper, "en");
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  expect(wrapper.get('[data-testid="language-status-en"]').text()).toBe(
    "Complete",
  );
  history.undo();
  expect(JSON.stringify(editor.content.value)).toBe(before);
  expect(history.canUndo.value).toBe(false);
});
