// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  createImageBlock,
  createHtmlBlock,
  createParagraphBlock,
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
