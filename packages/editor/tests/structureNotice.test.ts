// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createTitleBlock } from "@templatical/types";
import { openLanguages, languageContent } from "./helpers/localization";

describe("structure notice", () => {
  it("announces the first structure edit, dismisses and stays dismissed for this mount", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    editor.addBlock(createTitleBlock());
    await nextTick();
    const notice = wrapper.get('[data-testid="structure-notice"]');
    expect(notice.attributes("role")).toBe("status");
    expect(notice.text()).toContain(
      "Structure changes apply to every language.",
    );
    await notice.get("button").trigger("click");
    editor.addBlock(createTitleBlock());
    await nextTick();
    expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
      false,
    );
    const other = await openLanguages();
    other.editor.setActiveLocale("de");
    other.editor.addBlock(createTitleBlock());
    await nextTick();
    expect(
      other.wrapper.find('[data-testid="structure-notice"]').exists(),
    ).toBe(true);
  });
  it("tracks notices per template id across remounts and separately for another template", async () => {
    const config = {
      templates: {
        load: async (id: string) => ({ id, content: languageContent() }),
        save: false,
        create: false,
      },
    } as any;
    const first = await openLanguages(config);
    await first.editor.load("notice-one");
    first.editor.setActiveLocale("de");
    first.editor.addBlock(createTitleBlock());
    await nextTick();
    await first.wrapper
      .get('[data-testid="structure-notice"] button')
      .trigger("click");
    const second = await openLanguages(config);
    await second.editor.load("notice-one");
    second.editor.setActiveLocale("de");
    second.editor.addBlock(createTitleBlock());
    await nextTick();
    expect(
      second.wrapper.find('[data-testid="structure-notice"]').exists(),
    ).toBe(false);
    await second.editor.load("notice-two");
    second.editor.setActiveLocale("de");
    second.editor.addBlock(createTitleBlock());
    await nextTick();
    expect(
      second.wrapper.find('[data-testid="structure-notice"]').exists(),
    ).toBe(true);
  });
  it("does not announce ordinary text edits or default-language structure edits", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.addBlock(createTitleBlock());
    await nextTick();
    expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
      false,
    );
    editor.setActiveLocale("de");
    editor.updateBlock("title", { content: "Hallo!" } as any);
    await nextTick();
    expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
      false,
    );
    editor.removeBlock("image");
    await nextTick();
    expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
      true,
    );
  });
});
