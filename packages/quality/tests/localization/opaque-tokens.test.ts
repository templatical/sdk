import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  sourceHash,
  type SyntaxPreset,
} from "@templatical/types";
import { lintTemplate } from "../../src";

const brackets: SyntaxPreset = { value: /\[\[.+?\]\]/g, logic: /NEVER/g };

function mismatches(
  base: string,
  translated: string,
  mergeTagSyntax?: SyntaxPreset,
) {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createParagraphBlock({
      id: "copy",
      content: base,
      l10n: {
        de: {
          text: { content: { value: translated, sourceHash: sourceHash(base) } },
        },
      },
    }),
  ];
  return lintTemplate(content, { contentLocale: "de", mergeTagSyntax }).filter(
    (issue) => issue.ruleId === "localization.merge-tags-differ",
  );
}

describe("opaque localization tokens", () => {
  it("counts span tokens once with broad, overlapping consumer regexes", () => {
    const syntax: SyntaxPreset = { value: /\S+/g, logic: /\S+/g };
    const base = '<span data-merge-tag="[[name]]">First name</span>';
    expect(mismatches(base, "[[name]]", syntax)).toEqual([]);
    expect(mismatches(base, "[[other]]", syntax)).toMatchObject([
      { blockId: "copy" },
    ]);
  });

  it("detects a missing unsubscribe token in an href", () => {
    expect(
      mismatches(
        '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
        '<a href="https://example.com/unsubscribe">Abmelden</a>',
      ),
    ).toMatchObject([{ blockId: "copy", severity: "warning" }]);
  });

  it("detects a missing span token whose decoded value contains HTML-shaped text", () => {
    expect(
      mismatches(
        '<span data-merge-tag="[[a&lt;b]]">Label</span>',
        "Hallo",
        brackets,
      ),
    ).toHaveLength(1);
  });

  it("compares an encoded span token with the equivalent encoded raw token", () => {
    expect(
      mismatches(
        '<span data-merge-tag="[[a&lt;b]]">Label</span>',
        "Hallo [[a&lt;b]]",
        brackets,
      ),
    ).toEqual([]);
  });

  it("compares an encoded span token with a decoded raw token without parsing either as HTML", () => {
    expect(
      mismatches(
        '<span data-merge-tag="[[a&lt;b]]">Label</span>',
        "Hallo [[a<b]]",
        brackets,
      ),
    ).toEqual([]);
    expect(mismatches("Hello [[a<b]]", "Hallo", brackets)).toHaveLength(1);
  });

  it("decodes a recorded span value exactly once", () => {
    expect(
      mismatches(
        '<span data-merge-tag="[[a&amp;lt;b]]">Label</span>',
        "Hallo [[a&amp;lt;b]]",
        brackets,
      ),
    ).toEqual([]);
    expect(
      mismatches(
        '<span data-merge-tag="[[a&amp;lt;b]]">Label</span>',
        "Hallo [[a&lt;b]]",
        brackets,
      ),
    ).toHaveLength(1);
  });

  it("counts a recorded span token even when the configured regex does not match its value", () => {
    expect(
      mismatches('<span data-merge-tag="[[name]]">Label</span>', "Hallo"),
    ).toHaveLength(1);
  });

  it("removes the whole span, including nested labels and token-shaped metadata", () => {
    expect(
      mismatches(
        '<span data-merge-tag="{{name}}" data-label="{{metadata}}"><span>Label</span>{{label_only}}</span>',
        "Hallo {{name}}",
      ),
    ).toEqual([]);
  });
});
