import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
} from "@templatical/types";
import { lintTemplate } from "../src";

describe("deliverability in the aggregate linter", () => {
  it("appends real deliverability issues after accessibility, structure and links", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({ src: "https://example.com/image.png", alt: "" }),
      createSectionBlock(),
      createButtonBlock({ text: "Open report", url: "https://bit.ly/x" }),
      createButtonBlock({ text: "Other", url: "/relative" }),
    ];
    const ids = lintTemplate(content).map((issue) => issue.ruleId);
    expect(ids).toContain("a11y.img-missing-alt");
    expect(ids).toContain("structure.empty-section");
    expect(ids).toContain("link.relative-url");
    expect(ids).toContain("deliverability.url-shortener");
    expect(ids.indexOf("a11y.img-missing-alt")).toBeLessThan(ids.indexOf("structure.empty-section"));
    expect(ids.indexOf("structure.empty-section")).toBeLessThan(ids.indexOf("link.relative-url"));
    expect(ids.indexOf("link.relative-url")).toBeLessThan(ids.indexOf("deliverability.url-shortener"));
    expect(lintTemplate(content, { accessibility: false, structure: false, links: false })
      .map((issue) => issue.ruleId)).toEqual([
      "deliverability.url-shortener",
      "deliverability.low-text",
    ]);
  });
});
