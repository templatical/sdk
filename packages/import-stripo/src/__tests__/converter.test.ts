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
});
