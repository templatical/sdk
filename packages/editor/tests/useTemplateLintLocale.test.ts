import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
import {
  createCustomBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  sourceHash,
  type CustomBlockDefinition,
} from "@templatical/types";
import {
  useTemplateLint,
  isLintFullyDisabled,
} from "../src/composables/useTemplateLint";
import { resolveLintOptions } from "../src/utils/resolveLintOptions";

describe("live locale lint", () => {
  it("reruns on a language switch with custom definitions and configured merge-tag syntax", async () => {
    const initial = createDefaultTemplateContent();
    initial.settings.locales = ["de"];
    initial.blocks = [
      {
        ...createCustomBlock({
          type: "card",
          name: "Card",
          fields: [
            { key: "label", type: "text", label: "Label", default: "Hello" },
          ],
          template: "{{ label }}",
        }),
        id: "card",
      },
      createParagraphBlock({
        id: "copy",
        content: "Hello *|FNAME|*",
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo",
                sourceHash: sourceHash("Hello *|FNAME|*"),
              },
            },
          },
        },
      }),
    ];
    const content = ref(initial);
    const activeLocale = ref<string | null>(null);
    const customBlocks: CustomBlockDefinition[] = [
      {
        type: "card",
        name: "Card",
        fields: [{ key: "label", label: "Label", type: "text" }],
        template: "{{ label }}",
      },
    ];
    const options = computed(() =>
      resolveLintOptions({
        locale: "en",
        content: content.value,
        contentLocale: activeLocale.value ?? undefined,
      }),
    );
    const lint = useTemplateLint({
      content,
      get options() {
        return options.value;
      },
      customBlocks,
      mergeTagSyntax: "mailchimp",
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
      debounce: 1,
    });
    try {
      await vi.waitFor(() => expect(lint.ready.value).toBe(true));
      expect(
        lint.issues.value.filter((issue) =>
          issue.ruleId.startsWith("localization."),
        ),
      ).toEqual([]);
      activeLocale.value = "de";
      await nextTick();
      expect(
        lint.issues.value.map((issue) => `${issue.ruleId}@${issue.blockId}`),
      ).toContain("localization.untranslated@card");
      expect(
        lint.issues.value.map((issue) => `${issue.ruleId}@${issue.blockId}`),
      ).toContain("localization.merge-tags-differ@copy");
      activeLocale.value = null;
      await nextTick();
      expect(
        lint.issues.value.filter((issue) =>
          issue.ruleId.startsWith("localization."),
        ),
      ).toEqual([]);
    } finally {
      lint.destroy();
    }
  });

  it("keeps loading lint when localization is the only enabled category", () => {
    expect(
      isLintFullyDisabled({
        accessibility: false,
        structure: false,
        links: false,
        deliverability: false,
        compatibility: false,
      }),
    ).toBe(false);
  });
});
