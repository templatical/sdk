import { describe, expect, it } from "vitest";
import {
  convertMergeTagsToValues,
  getTagAttrValue,
  replaceMergeTagSpans,
} from "../src";

describe("merge-tag HTML scanning", () => {
  it("replaces nested chip labels completely while preserving surrounding markup", () => {
    const html =
      '<p>Hi <span class="chip" data-merge-tag="[[a&lt;b]]"><b>First</b><span>name</span></span>!</p>';
    expect(replaceMergeTagSpans(html, (value) => value)).toBe(
      "<p>Hi [[a<b]]!</p>",
    );
  });

  it("scans inside ordinary spans and ignores longer tag names", () => {
    const html =
      '<spandex>Text</spandex><span class="label"><span data-logic-merge-tag="{% if x &gt; 1 %}">IF</span></span>';
    expect(replaceMergeTagSpans(html, (value) => value)).toBe(
      '<spandex>Text</spandex><span class="label">{% if x > 1 %}</span>',
    );
  });

  it("keeps quoted angle brackets in attributes and decodes each token once", () => {
    expect(
      replaceMergeTagSpans(
        '<span title="a > b" data-merge-tag="[[a&amp;lt;b]]">Name</span>',
        (value) => value,
      ),
    ).toBe("[[a&lt;b]]");
  });

  it("decodes apos in a chip attribute for existing consumers", () => {
    const attrs = 'data-merge-tag="[[Rock &apos;n&apos; Roll]]"';
    const html = `<span ${attrs}>Music</span>`;
    expect(getTagAttrValue(attrs, "data-merge-tag")).toBe("[[Rock 'n' Roll]]");
    expect(convertMergeTagsToValues(html)).toBe("[[Rock 'n' Roll]]");
    expect(replaceMergeTagSpans(html, (value) => value)).toBe(
      "[[Rock 'n' Roll]]",
    );
  });

  it("does not scan replacement markup again", () => {
    const replacement = '<span data-merge-tag="{{other}}">Other</span>';
    const values: string[] = [];
    expect(
      replaceMergeTagSpans(
        '<span data-merge-tag="{{one}}">One</span> and <span data-logic-merge-tag="{% two %}">Two</span>',
        (value) => {
          values.push(value);
          return replacement;
        },
      ),
    ).toBe(`${replacement} and ${replacement}`);
    expect(values).toEqual(["{{one}}", "{% two %}"]);
  });

  it.each([
    "",
    "<p>No chips</p>",
    '<span data-merge-tag="{{name}}"',
    '<span data-merge-tag="{{name}}">Unclosed label',
    '<span data-merge-tag="{{name}}">Label <b',
    '<span data-merge-tag="{{name}}"><b>Label</b>',
    '<span data-merge-tag="{{name}}">',
  ])("preserves incomplete or chip-free markup: %s", (html) => {
    expect(replaceMergeTagSpans(html, (value) => value)).toBe(html);
  });

  it("preserves export's first-close behavior separately from whole-label replacement", () => {
    const html =
      '<span data-merge-tag="{{name}}">First<span>name</span>tail</span>';
    expect(convertMergeTagsToValues(html)).toBe("{{name}}tail</span>");
    expect(replaceMergeTagSpans(html, (value) => value)).toBe("{{name}}");
    const unclosed = '<span data-merge-tag="{{name}}">Name';
    expect(convertMergeTagsToValues(unclosed)).toBe(unclosed);
  });
});

describe("uppercase entity aliases in chip attributes", () => {
  it.each([
    ["&LT;% $email %&GT;", "<% $email %>"],
    ["[[AT&AMP;T]]", "[[AT&T]]"],
    ["[[&QUOT;email&QUOT;]]", '[["email"]]'],
    ["[[&COPY;]]", "[[©]]"],
    ["[[&REG;]]", "[[®]]"],
  ])("extracts %s for existing consumers", (encoded, token) => {
    expect(
      getTagAttrValue(`data-merge-tag="${encoded}"`, "data-merge-tag"),
    ).toBe(token);
    expect(
      getTagAttrValue('data-merge-tag="[[AT&aMp;T]]"', "data-merge-tag"),
    ).toBe("[[AT&aMp;T]]");
    expect(
      convertMergeTagsToValues(
        `<span data-merge-tag="${encoded}">Email</span>`,
      ),
    ).toBe(token);
    expect(
      convertMergeTagsToValues(
        '<span data-merge-tag="[[AT&aMp;T]]">Email</span>',
      ),
    ).toBe("[[AT&aMp;T]]");
  });
});
