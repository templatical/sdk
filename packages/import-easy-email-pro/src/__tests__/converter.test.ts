import { describe, expect, it } from "vitest";
import { convertEasyEmailProTemplate } from "../converter";
import type { EasyEmailProPage } from "../types";

const EMPTY_PAGE: EasyEmailProPage = {
  type: "page",
  data: {},
  attributes: {},
  children: [],
};

const INVALID_MESSAGE =
  "Invalid Easy Email Pro template: expected a page JSON object (EmailTemplate { subject, content } or the page element).";
const OSS_MESSAGE =
  "Invalid Easy Email Pro template: this looks like open-source Easy Email JSON, not Easy Email Pro (expected standard-* children).";

describe("convertEasyEmailProTemplate input guards", () => {
  it("throws a typed message for a non-object input", () => {
    expect(() => convertEasyEmailProTemplate(42 as never)).toThrow(
      INVALID_MESSAGE,
    );
  });

  it("throws the same message for unparseable JSON", () => {
    expect(() => convertEasyEmailProTemplate("{")).toThrow(INVALID_MESSAGE);
  });

  it("throws when type is missing", () => {
    expect(() =>
      convertEasyEmailProTemplate({ children: [] } as never),
    ).toThrow(INVALID_MESSAGE);
  });

  it("throws on an Unlayer-shaped object rather than importing it", () => {
    expect(() =>
      convertEasyEmailProTemplate({ body: { rows: [] } } as never),
    ).toThrow(INVALID_MESSAGE);
  });

  it("throws a dedicated message for OSS Easy Email JSON", () => {
    expect(() =>
      convertEasyEmailProTemplate({
        subject: "Hi",
        content: {
          type: "page",
          children: [{ type: "section", children: [] }],
        },
      } as never),
    ).toThrow(OSS_MESSAGE);
  });

  it("accepts a JSON string of a bare page", () => {
    const { content } = convertEasyEmailProTemplate(JSON.stringify(EMPTY_PAGE));
    expect(content.blocks).toEqual([]);
  });

  it("accepts the EmailTemplate envelope", () => {
    const { content } = convertEasyEmailProTemplate({
      subject: "Welcome",
      content: EMPTY_PAGE,
    });
    expect(content.blocks).toEqual([]);
  });

  it("ignores sibling html and mjml keys on the envelope", () => {
    const { content } = convertEasyEmailProTemplate({
      subject: "Welcome",
      content: EMPTY_PAGE,
      html: "<html></html>",
      mjml: "<mjml></mjml>",
    });
    expect(content.blocks).toEqual([]);
  });

  it("warns when the page has no convertible content", () => {
    const { report } = convertEasyEmailProTemplate(EMPTY_PAGE);
    expect(report.warnings).toEqual([
      "No convertible content was found in the Easy Email Pro page. Check that page.children holds at least one standard-section.",
    ]);
    expect(report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults every setting when the page declares none", () => {
    const { content } = convertEasyEmailProTemplate(EMPTY_PAGE);
    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect(content.settings.linkUnderline).toBe(true);
    expect(content.settings.locale).toBe("en");
    expect("preheaderText" in content.settings).toBe(false);
    expect("linkColor" in content.settings).toBe(false);
  });

  it("warns once when subject is non-empty", () => {
    const { report } = convertEasyEmailProTemplate({
      subject: "Welcome to Easy Email Pro",
      content: EMPTY_PAGE,
    });
    expect(report.warnings).toContain(
      'Document subject "Welcome to Easy Email Pro" has no TemplateSettings field and was dropped.',
    );
  });
});
