import { describe, expect, it } from "vitest";
import { convertStripoTemplate } from "../converter";

describe("convertStripoTemplate", () => {
  it("throws on a non-string", () => {
    expect(() => convertStripoTemplate(1 as unknown as string)).toThrow(
      "Invalid Stripo template: expected a string",
    );
  });

  it("throws on empty input", () => {
    expect(() => convertStripoTemplate("  ")).toThrow(
      "Invalid Stripo template: input is empty",
    );
  });

  it("delegates unrecognised HTML and warns", () => {
    const { content, report } = convertStripoTemplate(
      "<html><body><p>Loose Widget Copy</p></body></html>",
    );
    expect(report.warnings[0]).toBe(
      "No Stripo class attributes found; converted as generic HTML.",
    );
    const texts = JSON.stringify(content);
    expect(texts).toContain("Loose Widget Copy");
  });

  it("does not let plugin CSS break out of the style element and flip detection", () => {
    const html =
      '<table class="es-wrapper"><tr><td><p>Compiled Widget Copy</p></td></tr></table>';
    const { content } = convertStripoTemplate(html, {
      css: '</style><td class="esd-stripe">Injected Editor Stripe</td>',
    });
    const texts = JSON.stringify(content);
    expect(texts).toContain("Compiled Widget Copy");
    expect(texts).not.toContain("Injected Editor Stripe");
  });
});
