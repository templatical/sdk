import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createHtmlBlock,
  createParagraphBlock,
  SYNTAX_PRESETS,
  sourceHash,
  type SyntaxPreset,
} from "@templatical/types";
import { lintTemplate } from "@templatical/quality";
import { mergeTagsDiffer } from "../src/utils/mergeTagTokens";

const brackets: SyntaxPreset = { value: /\[\[.+?\]\]/g, logic: /NEVER/g };
const broad: SyntaxPreset = { value: /\S+/g, logic: /\S+/g };
const liquid = SYNTAX_PRESETS.liquid;

const cases: [string, string, SyntaxPreset][] = [
  ["Hello {{name}}", "Hallo {{name}}", liquid],
  ["Hello {{name}}", "Hallo", liquid],
  ["{{a}} and {{b}}", "{{b}} und {{a}}", liquid],
  ["{{a}} or {{a}}", "{{a}}", liquid],
  ['Hi <span data-merge-tag="{{name}}">Name</span>', "Hallo {{name}}", liquid],
  ['Hi <span data-merge-tag="{{name}}">Name</span>', "Hallo", liquid],
  [
    '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
    '<a href="https://example.com/u">Abmelden</a>',
    liquid,
  ],
  ["{% if vip %}VIP{% endif %}", "{% if vip %}VIP", liquid],
  ["{{ a &amp; b }}", "{{ a & b }}", liquid],
  ["[[Müller]]", "[[M&uuml;ller]]", brackets],
  ['<span data-merge-tag="[[name]]">[[label]]</span>', "[[name]]", brackets],
  ['<span data-merge-tag="[[a&lt;b]]">Label</span>', "Hallo", brackets],
  ['<span data-merge-tag="[[name]]">First name</span>', "[[name]]", broad],
  ['<span data-merge-tag="[[name]]">First name</span>', "[[other]]", broad],
  [
    'Hi<span data-merge-tag="[[n]]">N</span>there',
    'Hallo<span data-merge-tag="[[n]]">N</span>dort',
    broad,
  ],
];

/** What `localization.merge-tags-differ` reports for one translated field. */
function lintVerdict(
  type: "paragraph" | "html" | "button",
  base: string,
  translated: string,
  mergeTagSyntax: SyntaxPreset,
): boolean {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  const field = type === "button" ? "text" : "content";
  const l10n = {
    de: {
      text: { [field]: { value: translated, sourceHash: sourceHash(base) } },
    },
  };
  content.blocks = [
    type === "button"
      ? createButtonBlock({ id: "block", text: base, l10n })
      : type === "html"
        ? createHtmlBlock({ id: "block", content: base, l10n })
        : createParagraphBlock({ id: "block", content: base, l10n }),
  ];
  return lintTemplate(content, { contentLocale: "de", mergeTagSyntax }).some(
    (issue) => issue.ruleId === "localization.merge-tags-differ",
  );
}

describe("merge-tag multiset comparison", () => {
  it.each(cases)(
    "agrees with the localization lint for %j → %j",
    (base, translated, syntax) => {
      for (const type of ["paragraph", "html", "button"] as const)
        expect(
          mergeTagsDiffer(
            base,
            translated,
            syntax,
            type === "button" ? "text" : "html",
          ),
          type,
        ).toBe(lintVerdict(type, base, translated, syntax));
    },
  );

  it("reports the expected verdicts for the plain cases", () => {
    expect(
      mergeTagsDiffer("Hello {{name}}", "Hallo {{name}}", liquid, "html"),
    ).toBe(false);
    expect(mergeTagsDiffer("Hello {{name}}", "Hallo", liquid, "html")).toBe(
      true,
    );
    expect(
      mergeTagsDiffer("[[Müller]]", "[[M&uuml;ller]]", brackets, "html"),
    ).toBe(false);
    expect(
      mergeTagsDiffer("[[Müller]]", "[[M&uuml;ller]]", brackets, "text"),
    ).toBe(true);
  });
});
