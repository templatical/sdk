// @vitest-environment happy-dom
import "./dom-stubs";
import { expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { type TemplateContent } from "@templatical/types";
import { openLanguages } from "./helpers/localization";

it("resolves the active language and renders its plain result without reapplying layers", async () => {
  const seen: TemplateContent[] = [];
  const { wrapper, editor } = await openLanguages({
    localization: { locales: ["de", "fr"] },
    resolvePreview: async ({ content }) => {
      seen.push(content);
      const title = content.blocks[0] as { content: string };
      title.content = `Resolved ${content.settings.locale}: ${title.content}`;
      delete content.settings.locales;
      delete content.settings.l10n;
      for (const block of content.blocks) delete block.l10n;
      return content;
    },
  });
  editor.setActiveLocale("de");
  editor.setPreviewMode(true);
  await flushPromises();
  expect(seen[0].settings.locale).toBe("de");
  expect(seen[0].blocks[0]).not.toHaveProperty("l10n");
  expect(wrapper.get('[data-block-id="title"]').text()).toContain(
    "Resolved de: Hallo",
  );
  editor.setActiveLocale("fr");
  await nextTick();
  await flushPromises();
  expect(seen.map((content) => content.settings.locale)).toEqual(["de", "fr"]);
  expect(wrapper.get('[data-block-id="title"]').text()).toContain(
    "Resolved fr: Hello",
  );
});

it("discards a pending response after the language changes", async () => {
  const pending: Array<{
    content: TemplateContent;
    finish: (value: TemplateContent) => void;
  }> = [];
  const { wrapper, editor } = await openLanguages({
    localization: { locales: ["de", "fr"] },
    resolvePreview: ({ content }) =>
      new Promise((resolve) => pending.push({ content, finish: resolve })),
  });
  editor.setActiveLocale("de");
  editor.setPreviewMode(true);
  await nextTick();
  editor.setActiveLocale("fr");
  await nextTick();
  expect(pending).toHaveLength(2);
  pending[1].finish(pending[1].content);
  await flushPromises();
  pending[0].finish(pending[0].content);
  await flushPromises();
  expect(wrapper.get('[data-block-id="title"]').text()).toContain("Hello");
  expect(wrapper.get('[data-block-id="title"]').text()).not.toContain("Hallo");
});
