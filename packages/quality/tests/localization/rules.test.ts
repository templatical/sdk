import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createImageBlock,
  createMenuBlock,
  createCustomBlock,
  sourceHash,
  type CustomBlockDefinition,
} from "@templatical/types";
import {
  isLintFullyDisabled,
  lintTemplate,
  LOCALIZATION_RULES,
} from "../../src";

function template() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  return content;
}

const localization = (content: ReturnType<typeof template>, options = {}) =>
  lintTemplate(content, { contentLocale: "de", ...options }).filter((issue) =>
    issue.ruleId.startsWith("localization."),
  );

describe("localization rules", () => {
  it("reports each missing field including settings with null blockId, only in a version", () => {
    const content = template();
    content.blocks = [
      createImageBlock({
        id: "hero",
        src: "https://example.com/hero.png",
        alt: "Hero",
      }),
    ];
    content.settings.preheaderText = "Preview";
    expect(
      localization(content).map(
        ({ blockId, ruleId, severity, message, reference }) => ({
          blockId,
          ruleId,
          severity,
          message,
          reference,
        }),
      ),
    ).toEqual([
      {
        blockId: "hero",
        ruleId: "localization.untranslated",
        severity: "warning",
        message: "The field alt has no translation.",
        reference:
          "https://docs.templatical.com/guide/localized-templates#missing-values",
      },
      {
        blockId: null,
        ruleId: "localization.untranslated",
        severity: "warning",
        message: "The field preheaderText has no translation.",
        reference:
          "https://docs.templatical.com/guide/localized-templates#missing-values",
      },
    ]);
    expect(
      lintTemplate(content).filter((issue) =>
        issue.ruleId.startsWith("localization."),
      ),
    ).toEqual([]);
    expect(localization(content, { contentLocale: "en" })).toEqual([]);
  });

  it("reports stale text, with the field path and chosen message language", () => {
    const content = template();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: "New default",
        l10n: {
          de: {
            text: {
              content: {
                value: "Alter Text",
                source: sourceHash("Old default"),
              },
            },
          },
        },
      }),
    ];
    expect(localization(content, { locale: "en" })).toMatchObject([
      {
        blockId: "copy",
        ruleId: "localization.stale",
        severity: "warning",
        message: "The translation of content is out of date.",
      },
    ]);
    expect(localization(content, { locale: "de" })[0].message).toBe(
      "Die Übersetzung von content ist nicht mehr aktuell.",
    );
    expect(localization(content, { contentLocale: "en" })).toEqual([]);
  });

  it("compares merge tags as multisets, including logic and configured syntax", () => {
    const content = template();
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: "Hello *|FNAME|* *|FNAME|*",
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo *|FNAME|*",
                source: sourceHash("Hello *|FNAME|* *|FNAME|*"),
              },
            },
          },
        },
      }),
    ];
    expect(
      localization(content, { mergeTagSyntax: "mailchimp" }),
    ).toMatchObject([
      {
        blockId: "copy",
        ruleId: "localization.merge-tags-differ",
        severity: "warning",
      },
    ]);
    expect(
      localization(content, {
        contentLocale: "en",
        mergeTagSyntax: "mailchimp",
      }),
    ).toEqual([]);
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: "{% if user %}{{name}}{% endif %}",
        l10n: {
          de: {
            text: {
              content: {
                value: "{{name}}",
                source: sourceHash("{% if user %}{{name}}{% endif %}"),
              },
            },
          },
        },
      }),
    ];
    expect(localization(content).map((issue) => issue.ruleId)).toEqual([
      "localization.merge-tags-differ",
    ]);
    content.blocks = [
      createParagraphBlock({
        content: "Hello [[one]] [[two]]",
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo [[two]] [[one]]",
                source: sourceHash("Hello [[one]] [[two]]"),
              },
            },
          },
        },
      }),
    ];
    expect(
      localization(content, {
        mergeTagSyntax: { value: /\[\[.+?\]\]/, logic: /NEVER/ },
      }),
    ).toEqual([]);
  });

  it("lints the German projection once, keeping dictionaries unioned and messages independent", () => {
    const content = template();
    content.blocks = [
      createParagraphBlock({
        id: "link",
        content: '<a href="https://example.com">Click here</a>',
        l10n: {
          de: {
            text: {
              content: {
                value: '<a href="https://example.com">Hier klicken</a>',
                source: sourceHash(
                  '<a href="https://example.com">Click here</a>',
                ),
              },
            },
          },
        },
      }),
    ];
    const issues = lintTemplate(content, {
      contentLocale: "de",
      locale: "en",
    }).filter((issue) => issue.ruleId === "a11y.link-vague-text");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Hier klicken");
    expect(issues[0].message).not.toContain("Click here");
    expect(issues[0].message).toMatch(/link/i);
  });

  it("counts custom text definitions and skips hidden and orphaned text", () => {
    const content = template();
    const customBlocks: CustomBlockDefinition[] = [
      {
        type: "card",
        name: "Card",
        fields: [{ key: "label", type: "text", label: "Label" }],
        template: "{{ label }}",
      },
    ];
    content.blocks = [
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
        content: "Hidden {{tag}}",
        l10n: {
          de: {
            hidden: true,
            text: { content: { value: "Versteckt", source: "00000000" } },
          },
        },
      }),
      createMenuBlock({
        items: [],
        l10n: {
          de: {
            text: {
              "items.deleted.text": { value: "Verwaist", source: "00000000" },
            },
          },
        },
      }),
    ];
    expect(localization(content, { customBlocks })).toMatchObject([
      {
        blockId: "card",
        ruleId: "localization.untranslated",
        message: "The field fieldValues.label has no translation.",
      },
    ]);
  });

  it("registers configurable rules and includes localization in the disabled gate", () => {
    const content = template();
    content.blocks = [createParagraphBlock({ content: "Hello" })];
    const fiveOff = {
      accessibility: false,
      structure: false,
      links: false,
      deliverability: false,
      compatibility: false,
    } as const;
    expect(isLintFullyDisabled(fiveOff)).toBe(false);
    expect(LOCALIZATION_RULES.map((rule) => rule.meta.id)).toEqual([
      "localization.untranslated",
      "localization.stale",
      "localization.merge-tags-differ",
    ]);
    expect(
      lintTemplate(content, { ...fiveOff, contentLocale: "de" }),
    ).toHaveLength(1);
    expect(localization(content, { localization: false })).toEqual([]);
    expect(
      localization(content, {
        localization: { rules: { "localization.untranslated": "off" } },
      }),
    ).toEqual([]);
    expect(isLintFullyDisabled({ ...fiveOff, localization: false })).toBe(true);
  });

  it("rejects unknown language versions", () => {
    expect(() =>
      lintTemplate(template(), { contentLocale: "fr" }),
    ).toThrowError(expect.objectContaining({ code: "unknown_locale" }));
  });

  it("keeps slash-containing element ids in field paths and block ids intact", () => {
    const content = template();
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [
          {
            id: "item/one",
            text: "Hello {{name}}",
            url: "https://example.com",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
        l10n: {
          de: {
            text: {
              "items.item/one.text": { value: "Hallo", source: "00000000" },
            },
          },
        },
      }),
    ];
    expect(
      localization(content).map(({ blockId, ruleId, message }) => ({
        blockId,
        ruleId,
        message,
      })),
    ).toEqual([
      {
        blockId: "menu",
        ruleId: "localization.stale",
        message: "The translation of items.item/one.text is out of date.",
      },
      {
        blockId: "menu",
        ruleId: "localization.merge-tags-differ",
        message:
          "The merge tags in items.item/one.text differ from the default language.",
      },
    ]);
  });
});
