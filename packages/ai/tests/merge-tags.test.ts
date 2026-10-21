import { describe, expect, it } from "vitest";
import {
  flattenMergeTags,
  mergeTagTokens,
  mergeTagTokensIn,
  unknownMergeTags,
} from "../src/server";

describe("merge tags in AI input and output (S7 Y5)", () => {
  it.each([
    ["liquid", "Hi {{ first_name }} and {{coupon}}", ["{{ first_name }}", "{{coupon}}"]],
    ["handlebars", "Hi {{{raw}}} {{name}}", ["{{{raw}}}", "{{name}}"]],
    ["mailchimp", "Hi *|FNAME|*", ["*|FNAME|*"]],
    ["ampscript", "Hi %%=v(@name)=%%", ["%%=v(@name)=%%"]],
    ["custom", "Hi {{x}}", []],
  ] as const)("finds %s tokens", (syntax, text, tokens) => {
    expect(mergeTagTokens(text, syntax)).toEqual(tokens);
  });

  it("finds tokens in every string of a value", () => {
    expect(
      mergeTagTokensIn(
        { op: "updateBlock", set: { content: "<p>{{a}}</p>", alt: ["{{b}}"] } },
        "liquid",
      ),
    ).toEqual(["{{a}}", "{{b}}"]);
  });

  it("turns the editor's tags into their bare values", () => {
    expect(
      flattenMergeTags(
        '<p>Hi <span data-merge-tag="{{first_name}}" data-label="First">First</span>, <span class="x" data-merge-tag="*|A&amp;B|*">A&amp;B</span></p>',
      ),
    ).toBe("<p>Hi {{first_name}}, *|A&B|*</p>");
  });

  it("returns unterminated merge-tag spans unchanged in under 100 ms", () => {
    const html = '<span data-merge-tag=""'.repeat(900);
    const started = performance.now();
    const result = flattenMergeTags(html);
    const elapsed = performance.now() - started;
    expect(result).toBe(html);
    expect(elapsed).toBeLessThan(100);
  });

  it("names each unknown token once, in order, and checks nothing for custom", () => {
    expect(
      unknownMergeTags("liquid", ["{{a}}", "{{b}}", "{{a}}", "{{c}}", "{{b}}"], ["{{a}}"]),
    ).toEqual(["{{b}}", "{{c}}"]);
    expect(unknownMergeTags("custom", ["{{b}}"], [])).toEqual([]);
  });
});
