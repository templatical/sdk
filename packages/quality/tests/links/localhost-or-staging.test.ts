import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import { lintLinks } from "../../src";

describe("link.localhost-or-staging", () => {
  it("fires on localhost and 127.0.0.1 by default", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "http://localhost:3000/login" }),
      createButtonBlock({ url: "http://127.0.0.1:8080/x" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.localhost-or-staging",
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("localhost");
    expect(issues[1].message).toContain("127.0.0.1");
  });

  it("fires on glob patterns `*.local` and `*.staging.*`", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://app.local/x" }),
      createButtonBlock({ url: "https://app.staging.example.com/x" }),
    ];
    const issues = lintLinks(content).filter(
      (i) => i.ruleId === "link.localhost-or-staging",
    );
    expect(issues).toHaveLength(2);
  });

  it("does not fire on production hosts", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://example.com/x" }),
      createButtonBlock({ url: "https://www.acme.io" }),
    ];
    expect(
      lintLinks(content).filter(
        (i) => i.ruleId === "link.localhost-or-staging",
      ),
    ).toEqual([]);
  });

  it("does not fire on mailto/tel even when address mentions a host", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "mailto:hi@localhost.example.com" }),
      createButtonBlock({ url: "tel:+15551234567" }),
    ];
    expect(
      lintLinks(content).filter(
        (i) => i.ruleId === "link.localhost-or-staging",
      ),
    ).toEqual([]);
  });

  it("respects custom `nonProductionHosts` (only custom patterns fire)", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createButtonBlock({ url: "https://app.preview.example.com/x" }),
      createButtonBlock({ url: "http://localhost:3000/x" }),
    ];
    const issues = lintLinks(content, {
      links: { nonProductionHosts: ["*.preview.*"] },
    }).filter((i) => i.ruleId === "link.localhost-or-staging");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("preview");
  });

  it("disables host matching entirely with empty array", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "http://localhost/x" })];
    expect(
      lintLinks(content, { links: { nonProductionHosts: [] } }).filter(
        (i) => i.ruleId === "link.localhost-or-staging",
      ),
    ).toEqual([]);
  });

  it("anchors the host pattern so suffix-similar hosts do not match", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      // `*.local` is `^.*\.local$` — `app.example.com.local-tools` does NOT
      // end in `.local` so the pattern doesn't match.
      createButtonBlock({ url: "https://app.example.com.local-tools/x" }),
    ];
    const issues = lintLinks(content, {
      links: { nonProductionHosts: ["*.local"] },
    }).filter((i) => i.ruleId === "link.localhost-or-staging");
    expect(issues).toEqual([]);
  });

  it("respects severity override and `off` disables the rule", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createButtonBlock({ url: "http://localhost/x" })];

    const promoted = lintLinks(content, {
      links: { rules: { "link.localhost-or-staging": "error" } },
    }).find((i) => i.ruleId === "link.localhost-or-staging");
    expect(promoted?.severity).toBe("error");

    const off = lintLinks(content, {
      links: { rules: { "link.localhost-or-staging": "off" } },
    }).filter((i) => i.ruleId === "link.localhost-or-staging");
    expect(off).toEqual([]);

    expect(lintLinks(content, { disabled: true })).toEqual([]);
    expect(lintLinks(content, { links: false })).toEqual([]);
  });
});
