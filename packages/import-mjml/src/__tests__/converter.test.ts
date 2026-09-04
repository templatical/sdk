import { describe, expect, it } from "vitest";
import { convertMjmlTemplate } from "../converter";

describe("convertMjmlTemplate input guards", () => {
  it("throws a typed message for a non-string input", () => {
    expect(() => convertMjmlTemplate(42 as unknown as string)).toThrow(
      "Invalid MJML template: expected a string. Pass the raw MJML source as a string.",
    );
  });

  it("throws a typed message for an empty string", () => {
    expect(() => convertMjmlTemplate("   \n  ")).toThrow(
      "Invalid MJML template: input is empty. Pass the raw MJML source of an email.",
    );
  });

  it("warns and returns no blocks when the document has an empty mj-body", () => {
    const result = convertMjmlTemplate("<mjml><mj-body></mj-body></mjml>");

    expect(result.content.blocks).toEqual([]);
    expect(result.report.warnings).toEqual([
      "No convertible content was found in the MJML. Check that the document has an <mj-body> with at least one <mj-section>.",
    ]);
    expect(result.report.summary).toEqual({
      total: 0,
      converted: 0,
      approximated: 0,
      htmlFallback: 0,
      skipped: 0,
    });
  });

  it("defaults settings when the document declares none", () => {
    const { content } = convertMjmlTemplate("<mjml><mj-body></mj-body></mjml>");

    expect(content.settings.width).toBe(600);
    expect(content.settings.backgroundColor).toBe("#ffffff");
    expect(content.settings.fontFamily).toBe("Arial");
    expect(content.settings.textColor).toBe("#1a1a1a");
    expect(content.settings.locale).toBe("en");
    expect(content.settings.preheaderText).toBeUndefined();
  });
});
