import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import { lintLinks } from "../../src";

describe("link.unsupported-protocol", () => {
  it("does not fire on http/https/mailto/tel/sms", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://example.com" }),
      createButtonBlock({ url: "http://example.com" }),
      createButtonBlock({ url: "mailto:hi@example.com" }),
      createButtonBlock({ url: "tel:+15551234567" }),
      createButtonBlock({ url: "sms:+15551234567" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.unsupported-protocol",
    );
    expect(issues).toEqual([]);
  });

  it("does not fire on relative URLs or bare paths", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "/path/to/page" }),
      createButtonBlock({ url: "page.html" }),
      createButtonBlock({ url: "#anchor" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.unsupported-protocol",
    );
    expect(issues).toEqual([]);
  });

  it("does not fire on `javascript:` (its own rule covers that)", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "javascript:alert(1)" })];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.unsupported-protocol",
    );
    expect(issues).toEqual([]);
  });

  it("fires on ftp:, file:, data:, custom app schemes", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "ftp://example.com/file" }),
      createButtonBlock({ url: "file:///etc/passwd" }),
      createButtonBlock({ url: "data:text/plain,hello" }),
      createButtonBlock({ url: "myapp://open?id=42" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.unsupported-protocol",
    );
    expect(issues).toHaveLength(4);
    expect(issues[0].severity).toBe("warning");
    const protocols = issues.map((i) =>
      i.message.match(/"([^"]+)"/)?.[1],
    );
    expect(protocols).toEqual(["ftp", "file", "data", "myapp"]);
  });

  it("fires on anchors inside paragraph content", () => {
    const content = createDefaultTemplateContent();
    const paragraph = createParagraphBlock({
      content: '<p><a href="ftp://x">x</a></p>',
    });
    content.blocks = [paragraph];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.unsupported-protocol",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(paragraph.id);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "ftp://example.com" })];

    const promoted = lintLinks(content, {
      links: { rules: { "link.unsupported-protocol": "error" } },
    }).find((i) => i.ruleId === "link.unsupported-protocol");
    expect(promoted?.severity).toBe("error");

    const off = lintLinks(content, {
      links: { rules: { "link.unsupported-protocol": "off" } },
    }).filter((i) => i.ruleId === "link.unsupported-protocol");
    expect(off).toEqual([]);

    expect(lintLinks(content, { disabled: true })).toEqual([]);
    expect(lintLinks(content, { links: false })).toEqual([]);
  });
});
