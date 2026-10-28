import { describe, expect, it, vi } from "vitest";
import {
  createDefaultTemplateContent,
  createButtonBlock,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  sourceHash,
} from "@templatical/types";
import { lintTemplate } from "../../src";

function template() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  return content;
}

describe("localized lint review regressions", () => {
  it("compares plain button tokens literally while keeping HTML entity spellings equivalent", () => {
    const content = template();
    const base = "[[Müller]]";
    const layer = {
      de: {
        text: {
          content: { value: "[[M&uuml;ller]]", sourceHash: sourceHash(base) },
        },
      },
    };
    content.blocks = [
      createButtonBlock({
        id: "button",
        text: base,
        l10n: {
          de: {
            text: {
              text: { value: "[[M&uuml;ller]]", sourceHash: sourceHash(base) },
            },
          },
        },
      }),
      createParagraphBlock({ id: "paragraph", content: base, l10n: layer }),
      createHtmlBlock({ id: "html", content: base, l10n: layer }),
    ];
    const issues = lintTemplate(content, {
      contentLocale: "de",
      mergeTagSyntax: { value: /\[\[.+?\]\]/g, logic: /NEVER/g },
    }).filter((issue) => issue.ruleId === "localization.merge-tags-differ");
    expect(issues.map(({ blockId }) => blockId)).toEqual(["button"]);
  });

  it("treats chip-shaped strings as literal text in buttons and as chips in HTML", () => {
    const content = template();
    const base = '<span data-merge-tag="[[name]]">[[label]]</span>';
    content.blocks = [
      createButtonBlock({
        id: "button",
        text: base,
        l10n: {
          de: {
            text: { text: { value: "[[name]]", sourceHash: sourceHash(base) } },
          },
        },
      }),
      createParagraphBlock({
        id: "paragraph",
        content: base,
        l10n: {
          de: {
            text: {
              content: { value: "[[name]]", sourceHash: sourceHash(base) },
            },
          },
        },
      }),
    ];
    const issues = lintTemplate(content, {
      contentLocale: "de",
      mergeTagSyntax: { value: /\[\[.+?\]\]/g, logic: /NEVER/g },
    }).filter((issue) => issue.ruleId === "localization.merge-tags-differ");
    expect(issues.map(({ blockId }) => blockId)).toEqual(["button"]);
  });

  it.each([
    [
      "value spans and their metadata",
      '<span data-merge-tag="{{name}}" data-label="{{metadata}}">{{name}}</span>',
      "Hallo {{name}}",
    ],
    [
      "logic spans",
      '<span data-logic-merge-tag="{% if user %}">{% if user %}</span>',
      "{% if user %}",
    ],
    [
      "encoded span tokens",
      '<span data-merge-tag="&#123;&#123;name&#125;&#125;">Name</span>',
      "{{name}}",
    ],
    [
      "encoded logic operators",
      '<span data-logic-merge-tag="{% if score &gt; 1 %}">IF</span>',
      "{% if score > 1 %}",
    ],
    [
      "text and span tokens decoded once",
      '<span data-merge-tag="{{a&amp;lt;b}}">Label</span>',
      "Hallo {{a&amp;lt;b}}",
    ],
  ])(
    "counts equivalent rendered tokens equally for %s",
    (_name, base, translated) => {
      const content = template();
      content.blocks = [
        createParagraphBlock({
          content: base,
          l10n: {
            de: {
              text: {
                content: { value: translated, sourceHash: sourceHash(base) },
              },
            },
          },
        }),
      ];
      expect(
        lintTemplate(content, { contentLocale: "de" }).filter(
          (issue) => issue.ruleId === "localization.merge-tags-differ",
        ),
      ).toEqual([]);
    },
  );

  it("counts tokens in attributes left outside merge-tag spans", () => {
    const content = template();
    const base = '<p data-label="{{metadata}}">Hello {{name}}</p>';
    content.blocks = [
      createParagraphBlock({
        content: base,
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo {{name}}",
                sourceHash: sourceHash(base),
              },
            },
          },
        },
      }),
    ];
    expect(
      lintTemplate(content, { contentLocale: "de" }).filter(
        (issue) => issue.ruleId === "localization.merge-tags-differ",
      ),
    ).toHaveLength(1);
  });

  it("still flags one rendered tag against two raw tags", () => {
    const content = template();
    const base = '<span data-merge-tag="{{name}}">{{name}}</span>';
    content.blocks = [
      createParagraphBlock({
        id: "copy",
        content: base,
        l10n: {
          de: {
            text: {
              content: {
                value: "Hallo {{name}} {{name}}",
                sourceHash: sourceHash(base),
              },
            },
          },
        },
      }),
    ];
    expect(
      lintTemplate(content, { contentLocale: "de" }).filter(
        (issue) => issue.ruleId === "localization.merge-tags-differ",
      ),
    ).toMatchObject([{ blockId: "copy", severity: "warning" }]);
  });

  it("keeps an empty-section finding without a removal fix when German hides its children", () => {
    const content = template();
    content.blocks = [
      createSectionBlock({
        id: "section",
        children: [
          [
            createParagraphBlock({
              content: "English content",
              l10n: { de: { hidden: true } },
            }),
          ],
        ],
      }),
    ];
    const issue = lintTemplate(content, { contentLocale: "de" }).find(
      (finding) => finding.ruleId === "structure.empty-section",
    );
    expect(issue).toMatchObject({ blockId: "section", severity: "warning" });
    expect(issue).not.toHaveProperty("fix");
  });

  it("omits removal fixes for genuinely empty sections in German while keeping default-language fixes", () => {
    const content = template();
    content.blocks = [createSectionBlock({ id: "empty", children: [[]] })];
    const german = lintTemplate(content, { contentLocale: "de" }).find(
      (finding) => finding.ruleId === "structure.empty-section",
    );
    expect(german).toMatchObject({ blockId: "empty" });
    expect(german).not.toHaveProperty("fix");
    for (const options of [{}, { contentLocale: "en" }]) {
      const english = lintTemplate(content, options).find(
        (finding) => finding.ruleId === "structure.empty-section",
      );
      const removeBlock = vi.fn();
      expect(english?.fix).toBeDefined();
      english!.fix!.apply({
        updateBlock: vi.fn(),
        updateSettings: vi.fn(),
        removeBlock,
      });
      expect(removeBlock).toHaveBeenCalledExactlyOnceWith("empty");
    }
  });

  it("retains patch fixes alongside findings whose removal fixes are omitted", () => {
    const content = template();
    content.blocks = [
      createSectionBlock({ id: "empty", children: [[]] }),
      createImageBlock({
        id: "decorative",
        src: "https://example.com/image.png",
        alt: "Unneeded alt",
        decorative: true,
      }),
    ];
    const issues = lintTemplate(content, { contentLocale: "de" });
    expect(
      issues.find((issue) => issue.ruleId === "structure.empty-section"),
    ).not.toHaveProperty("fix");
    const patch = issues.find(
      (issue) => issue.ruleId === "a11y.img-decorative-needs-empty-alt",
    )?.fix;
    expect(patch).toBeDefined();
    const updateBlock = vi.fn();
    const removeBlock = vi.fn();
    patch!.apply({ updateBlock, updateSettings: vi.fn(), removeBlock });
    expect(updateBlock).toHaveBeenCalledExactlyOnceWith("decorative", {
      alt: "",
    });
    expect(removeBlock).not.toHaveBeenCalled();
  });
});
