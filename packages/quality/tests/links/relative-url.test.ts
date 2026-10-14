import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import { lintLinks } from "../../src";

describe("link.relative-url", () => {
  it("fires on root-relative, ./ and ../ relative, query-only, and protocol-relative URLs", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "/contact" }),
      createButtonBlock({ url: "./pricing" }),
      createButtonBlock({ url: "../pricing" }),
      createButtonBlock({ url: "?ref=footer" }),
      createButtonBlock({ url: "//cdn.example.com/x" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.relative-url",
    );
    expect(issues).toHaveLength(5);
    expect(issues[0].severity).toBe("warning");
    expect(issues.map((i) => i.message.match(/"([^"]+)"/)?.[1])).toEqual([
      "/contact",
      "./pricing",
      "../pricing",
      "?ref=footer",
      "//cdn.example.com/x",
    ]);
  });

  it("fires on a whitespace-padded relative URL", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "  /contact " })];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.relative-url",
    );
    expect(issues).toHaveLength(1);
  });

  it("fires on anchors inside paragraph content", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({
      content: '<p><a href="/contact">Contact us</a></p>',
    });
    content.blocks = [paragraph];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.relative-url",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(paragraph.id);
  });

  it("does not fire on absolute URLs, other schemes, anchors, or empty URLs", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://example.com/contact" }),
      createButtonBlock({ url: "mailto:hi@example.com" }),
      createButtonBlock({ url: "tel:+15551234567" }),
      createButtonBlock({ url: "#section-2" }),
      createButtonBlock({ url: "" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.relative-url",
    );
    expect(issues).toEqual([]);
  });

  // The linter has no merge-tag syntax, so it keys on path-shaped prefixes
  // only: a leading tag is completed by the sending system, and a scheme-less
  // host is outside this rule.
  it("does not fire on merge-tag URLs or scheme-less hosts", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "{{ unsubscribe_url }}" }),
      createButtonBlock({ url: "*|ARCHIVE|*" }),
      createButtonBlock({ url: "example.com/contact" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.relative-url",
    );
    expect(issues).toEqual([]);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "/contact" })];

    const promoted = lintLinks(content, {
      links: { rules: { "link.relative-url": "error" } },
    }).find((i) => i.ruleId === "link.relative-url");
    expect(promoted?.severity).toBe("error");

    const off = lintLinks(content, {
      links: { rules: { "link.relative-url": "off" } },
    }).filter((i) => i.ruleId === "link.relative-url");
    expect(off).toEqual([]);
  });
});
