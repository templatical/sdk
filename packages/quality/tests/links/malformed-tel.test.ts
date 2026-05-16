import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintLinks } from "../../src";

describe("link.malformed-tel", () => {
  it("accepts well-formed tel: URIs", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "tel:+15551234567" }),
      createButtonBlock({ url: "tel:(555) 123-4567" }),
      createButtonBlock({ url: "tel:555.123.4567" }),
    ];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-tel"),
    ).toEqual([]);
  });

  it("accepts RFC-3966 extension and parameter syntax", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "tel:+15551234567;ext=42" }),
      createButtonBlock({
        url: "tel:+15551234567;phone-context=example.com",
      }),
      createButtonBlock({ url: "tel:911;isub=12345" }),
    ];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-tel"),
    ).toEqual([]);
  });

  it("still fires when a parameter is malformed", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "tel:+15551234567;=missingname" }),
    ];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-tel"),
    ).toHaveLength(1);
  });

  it("fires when the value is empty", () => {
    const content = createDefaultTemplateContent();
    const b = createButtonBlock({ url: "tel:" });
    content.blocks = [b];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-tel",
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].blockId).toBe(b.id);
    expect(issues[0].severity).toBe("warning");
  });

  it("fires when the value contains letters", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "tel:CALL-NOW" })];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.malformed-tel",
    );
    expect(issues).toHaveLength(1);
  });

  it("does not fire on non-tel schemes", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "https://example.com" })];
    expect(
      lintLinks(content).filter((i) => i.ruleId === "link.malformed-tel"),
    ).toEqual([]);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "tel:CALL-NOW" })];

    const promoted = lintLinks(content, {
      links: { rules: { "link.malformed-tel": "error" } },
    }).find((i) => i.ruleId === "link.malformed-tel");
    expect(promoted?.severity).toBe("error");

    const off = lintLinks(content, {
      links: { rules: { "link.malformed-tel": "off" } },
    }).filter((i) => i.ruleId === "link.malformed-tel");
    expect(off).toEqual([]);

    expect(lintLinks(content, { disabled: true })).toEqual([]);
    expect(lintLinks(content, { links: false })).toEqual([]);
  });
});
