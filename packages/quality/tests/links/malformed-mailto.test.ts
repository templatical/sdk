import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintLinks } from "../../src";

describe("link.malformed-mailto", () => {
  it("does not fire on a valid mailto", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "mailto:hi@example.com" })];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-mailto"),
    ).toEqual([]);
  });

  it("accepts query-string fragments (subject, cc, body)", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({
        url: "mailto:hi@example.com?subject=Hi&body=Hello",
      }),
    ];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-mailto"),
    ).toEqual([]);
  });

  it("accepts multiple comma-separated recipients", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "mailto:a@example.com,b@example.com" }),
    ];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-mailto"),
    ).toEqual([]);
  });

  it("fires when the address is empty", () => {
    const content = createDefaultTemplateContent();
    const b = createButtonBlock({ url: "mailto:" });
    content.blocks = [b];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-mailto",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(b.id);
    expect(issues[0].severity).toBe("warning");
  });

  it("fires when the address has no `@`", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "mailto:notanemail" })];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-mailto",
    );
    expect(issues).toHaveLength(1);
  });

  it("fires when the local or domain part is empty", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "mailto:@example.com" }),
      createButtonBlock({ url: "mailto:hi@" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-mailto",
    );
    expect(issues).toHaveLength(2);
  });

  it("fires when the domain is missing a dot", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "mailto:hi@localhost" })];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-mailto",
    );
    expect(issues).toHaveLength(1);
  });

  it("does not fire on non-mailto schemes", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "https://example.com" })];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-mailto"),
    ).toEqual([]);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "mailto:notanemail" })];

    const promoted = lintLinks(content, {
      links: { rules: { "link.malformed-mailto": "error" } },
    }).find((i) => i.ruleId === "link.malformed-mailto");
    expect(promoted?.severity).toBe("error");

    const off = lintLinks(content, {
      links: { rules: { "link.malformed-mailto": "off" } },
    }).filter((i) => i.ruleId === "link.malformed-mailto");
    expect(off).toEqual([]);

    expect(lintLinks(content, { disabled: true })).toEqual([]);
    expect(lintLinks(content, { links: false })).toEqual([]);
  });
});
