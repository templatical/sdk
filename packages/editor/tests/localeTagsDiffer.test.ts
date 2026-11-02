// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  createImageBlock,
  createHtmlBlock,
  createParagraphBlock,
  createMenuBlock,
  sourceHash,
} from "@templatical/types";
import Canvas from "../src/components/Canvas.vue";
import { TEMPLATE_LINT_KEY } from "../src/keys";
import { languageContent, openLanguages } from "./helpers/localization";

function contentWithTags(value = "Hallo", hash = sourceHash("Hello {{name}}")) {
  const content = languageContent();
  content.blocks = [
    createImageBlock({
      id: "tagged",
      alt: "Hello {{name}}",
      l10n: {
        de: {
          text: { alt: { value, sourceHash: hash } },
          set: { src: "https://example.com/de.png" },
        },
      },
    }),
  ];
  return content;
}
const chip = '[data-testid="locale-chip"]';
describe("merge-tag mismatch badges", () => {
  it("confirms replacing another current translation before re-translating the block in one undo step", async () => {
    const content = languageContent();
    content.blocks = [
      createMenuBlock({
        id: "tagged",
        items: [
          { id: "a", text: "Hello {{name}}", url: "" },
          { id: "b", text: "Two", url: "" },
        ],
        l10n: {
          de: {
            text: {
              "items.a.text": {
                value: "Hallo",
                sourceHash: sourceHash("Hello {{name}}"),
              },
              "items.b.text": {
                value: "Handgeschrieben",
                sourceHash: sourceHash("Two"),
              },
            },
          },
        },
      }),
    ];
    const translate = vi.fn(async (request) => ({
      fields: request.fields.map((field: { id: string }) => ({
        id: field.id,
        text: field.id.endsWith("items.a.text") ? 'Hallo <x id="1"/>' : "Zwei",
      })),
    }));
    const { wrapper, editor, history } = await openLanguages({
      content,
      translation: { translate },
    });
    editor.setActiveLocale("de");
    await nextTick();
    const before = JSON.stringify(editor.content.value);
    await wrapper.get(chip).trigger("click");
    await wrapper.get('[data-testid="locale-retranslate"]').trigger("click");
    const popover = () => wrapper.get('[data-testid="locale-popover"]');
    expect(popover().text()).toContain("Translate all 2 fields again?");
    expect(popover().text()).toContain(
      "This replaces the current Deutsch translations, including manual edits. You can undo it.",
    );
    expect(translate).not.toHaveBeenCalled();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    await popover()
      .get('[data-testid="translation-confirm-cancel"]')
      .trigger("click");
    expect(translate).not.toHaveBeenCalled();
    expect(popover().text()).not.toContain("Translate all 2 fields again?");
    await wrapper.get('[data-testid="locale-retranslate"]').trigger("click");
    expect(popover().get('[data-testid="translation-confirm"]').text()).toBe(
      "Translate all 2 fields",
    );
    await popover().get('[data-testid="translation-confirm"]').trigger("click");
    await vi.waitFor(() => {
      expect(translate).toHaveBeenCalledTimes(1);
      expect(
        editor.content.value.blocks[0].l10n?.de.text?.["items.b.text"].value,
      ).toBe("Zwei");
    });
    expect(
      translate.mock.calls[0][0].fields.map(
        (field: { id: string }) => field.id,
      ),
    ).toEqual(["tagged/items.a.text", "tagged/items.b.text"]);
    history.undo();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("explains an HTML mismatch without offering an ineligible translation", async () => {
    const content = languageContent();
    content.blocks = [
      createHtmlBlock({
        id: "html",
        content: "<div>Hello {{name}}</div>",
        l10n: {
          de: {
            text: {
              content: {
                value: "<div>Hallo</div>",
                sourceHash: sourceHash("<div>Hello {{name}}</div>"),
              },
            },
          },
        },
      }),
    ];
    const { wrapper, editor } = await openLanguages({
      content,
      translation: { translate: async () => ({ fields: [] }) },
    });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.get(chip).attributes("data-state")).toBe("tags-differ");
    await wrapper.get(chip).trigger("click");
    expect(wrapper.find('[data-testid="locale-retranslate"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[data-testid="locale-use-default"]').text()).toBe(
      "Use English",
    );
  });

  it.each([true, false])(
    "signals a current mismatch above changed properties with provider=%s",
    async (provider) => {
      const translate = vi.fn(async (request) => ({
        fields: request.fields.map((field: { id: string }) => ({
          id: field.id,
          text: 'Hallo <x id="1"/>',
        })),
      }));
      const { wrapper, editor } = await openLanguages({
        content: contentWithTags(),
        lint: { disabled: true },
        ...(provider ? { translation: { translate } } : {}),
      });
      editor.setActiveLocale("de");
      await nextTick();
      expect(wrapper.get(chip).attributes("data-state")).toBe("tags-differ");
      expect(wrapper.get(chip).attributes("aria-label")).toBe(
        "Merge tags differ",
      );
      expect(wrapper.get(chip).attributes("title")).toBe("Merge tags differ");
      expect(wrapper.get(`${chip} svg`).classes()).toContain(
        "lucide-triangle-alert",
      );
      await wrapper.get(chip).trigger("click");
      expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
        "Its merge tags don't match the English text.",
      );
      expect(wrapper.find('[data-testid="locale-keep"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="locale-retranslate"]').exists()).toBe(
        provider,
      );
      if (provider) {
        await wrapper
          .get('[data-testid="locale-retranslate"]')
          .trigger("click");
        await vi.waitFor(() => expect(translate).toHaveBeenCalledTimes(1));
        expect(
          translate.mock.calls[0][0].fields.map(
            (field: { id: string }) => field.id,
          ),
        ).toEqual(["tagged/alt"]);
        await vi.waitFor(() =>
          expect(editor.content.value.blocks[0].l10n?.de.text?.alt.value).toBe(
            "Hallo {{name}}",
          ),
        );
      } else {
        expect(wrapper.get('[data-testid="locale-use-default"]').text()).toBe(
          "Use English",
        );
        await wrapper
          .get('[data-testid="locale-use-default"]')
          .trigger("click");
        expect(editor.content.value.blocks[0].l10n?.de.text).toBeUndefined();
        expect(editor.content.value.blocks[0].l10n?.de.set).toEqual({
          src: "https://example.com/de.png",
        });
        await nextTick();
        expect(wrapper.get(chip).attributes("data-state")).toBe("missing");
      }
    },
  );
  it("keeps stale above a mismatch and opens a fresh mismatch from Issues", async () => {
    const { wrapper, editor } = await openLanguages({
      content: contentWithTags("Hallo", sourceHash("Old")),
    });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.get(chip).attributes("data-state")).toBe("stale");
    editor.keepTranslations("tagged", ["alt"]);
    await nextTick();
    expect(wrapper.get(chip).attributes("data-state")).toBe("tags-differ");
    await wrapper.get("#tpl-tab-issues").trigger("click");
    await vi.dynamicImportSettled();
    const lint = (wrapper.findComponent(Canvas).vm as any).$.provides[
      TEMPLATE_LINT_KEY as symbol
    ];
    lint.issues.value = [
      {
        ruleId: "localization.merge-tags-differ",
        blockId: "tagged",
        severity: "warning",
        message: "Merge tags differ",
      },
    ];
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      () => {},
    );
    await nextTick();
    await wrapper.get('[data-testid="issue-jump"]').trigger("click");
    await nextTick();
    expect(wrapper.get('[data-testid="locale-popover"]').text()).toContain(
      "Its merge tags don't match the English text.",
    );
  });
  it("counts a default chip and a raw translated tag as the same tag", async () => {
    const content = languageContent();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: '<p>Hi <span data-merge-tag="{{name}}">Name</span></p>',
        l10n: {
          de: {
            text: {
              content: {
                value: "<p>Hallo {{name}}</p>",
                sourceHash: sourceHash(
                  '<p>Hi <span data-merge-tag="{{name}}">Name</span></p>',
                ),
              },
            },
          },
        },
      }),
    ];
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.find(chip).exists()).toBe(false);
    editor.updateBlock("copy", { content: "<p>Hallo</p>" } as any);
    await nextTick();
    expect(wrapper.get(chip).attributes("data-state")).toBe("tags-differ");
  });

  it("compares tag multisets rather than their order", async () => {
    const content = contentWithTags("{{last}} Hallo {{name}}");
    content.blocks[0].alt = "Hello {{name}} {{last}}";
    content.blocks[0].l10n!.de.text!.alt.sourceHash = sourceHash(
      "Hello {{name}} {{last}}",
    );
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    expect(wrapper.get(chip).attributes("data-state")).toBe("changed");
  });
});
