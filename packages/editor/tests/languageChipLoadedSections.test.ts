// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createParagraphBlock } from "@templatical/types";
import { hiddenSectionContent } from "../../../apps/playground/e2e/helpers/language-chip-content";
import { languageContent, openLanguages } from "./helpers/localization";
import { getBlockWrapperStyle } from "../src/utils/blockComponentResolver";

describe("browser hidden-section fixtures", () => {
  it.each([false, true])(
    "renders loaded sections (nested: %s)",
    async (nested) => {
      const content = languageContent();
      content.blocks.push(
        createParagraphBlock({ id: "missing", content: "Hello" }),
        createParagraphBlock({
          id: "stale",
          content: "Hello",
          l10n: {
            de: {
              text: { content: { value: "Hallo", sourceHash: "00000000" } },
            },
          },
        }),
      );
      const loaded = hiddenSectionContent(content, nested);
      expect(() => getBlockWrapperStyle(loaded.blocks[0])).not.toThrow();
      const { wrapper, editor } = await openLanguages({
        templates: { load: async (id) => ({ id, content: loaded }) },
      });
      await editor.load("loaded-sections");
      editor.setActiveLocale("de");
      await nextTick();
      expect(
        wrapper
          .get(
            '[data-block-id="hidden-section"] > .tpl-block-badges > [data-testid="locale-chip"]',
          )
          .attributes("data-state"),
      ).toBe("hidden");
      for (const id of ["missing", "stale"])
        expect(
          wrapper
            .get(`[data-block-id="${id}"]`)
            .find('[data-testid="locale-chip"]')
            .exists(),
        ).toBe(false);
      await wrapper
        .get(
          '[data-block-id="hidden-section"] > .tpl-block-badges > [data-testid="locale-chip"]',
        )
        .trigger("click");
      await wrapper.get('[data-testid="locale-show"]').trigger("click");
      expect(
        wrapper
          .get('[data-block-id="missing"] [data-testid="locale-chip"]')
          .attributes("data-state"),
      ).toBe("missing");
      expect(
        wrapper
          .get('[data-block-id="stale"] [data-testid="locale-chip"]')
          .attributes("data-state"),
      ).toBe("stale");
    },
  );
});
