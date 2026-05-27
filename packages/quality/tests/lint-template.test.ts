import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  type TemplateContent,
} from "@templatical/types";
import {
  lintAccessibility,
  lintLinks,
  lintStructure,
  lintTemplate,
} from "../src";

/**
 * A template that trips at least one rule from each linter:
 *  - accessibility: image with empty alt   → a11y.img-missing-alt
 *  - links:         javascript: anchor      → link.javascript-protocol
 *  - structure:     section w/ empty column → structure.*
 */
function buildMultiIssueTemplate(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createImageBlock({ src: "https://example.com/x.png", alt: "" }),
    createParagraphBlock({
      content: '<p><a href="javascript:alert(1)">go</a></p>',
    }),
    createSectionBlock(),
  ];
  return content;
}

const namespaces = (issues: { ruleId: string }[]) =>
  new Set(issues.map((i) => i.ruleId.split(".")[0]));

// `fix` carries a freshly-built closure per linter call, so identity-compare
// the serializable surface instead of the raw issue objects.
const fingerprint = (issues: { ruleId: string; blockId: string | null }[]) =>
  issues.map((i) => `${i.ruleId}@${i.blockId ?? "template"}`);

describe("lintTemplate", () => {
  it("returns the concatenation of every linter, a11y then structure then links", () => {
    const content = buildMultiIssueTemplate();

    const expected = [
      ...lintAccessibility(content),
      ...lintStructure(content),
      ...lintLinks(content),
    ];

    expect(fingerprint(lintTemplate(content))).toEqual(fingerprint(expected));
  });

  it("surfaces issues from all three linter categories at once", () => {
    const issues = lintTemplate(buildMultiIssueTemplate());

    expect(namespaces(issues)).toEqual(new Set(["a11y", "structure", "link"]));
    expect(issues.some((i) => i.ruleId === "a11y.img-missing-alt")).toBe(true);
    expect(issues.some((i) => i.ruleId === "link.javascript-protocol")).toBe(
      true,
    );
  });

  it("returns [] when options.disabled is true", () => {
    expect(lintTemplate(buildMultiIssueTemplate(), { disabled: true })).toEqual(
      [],
    );
  });

  it("returns [] when every per-category key is false", () => {
    const issues = lintTemplate(buildMultiIssueTemplate(), {
      accessibility: false,
      structure: false,
      links: false,
    });
    expect(issues).toEqual([]);
  });

  it("skips only the category turned off, keeping the rest", () => {
    const issues = lintTemplate(buildMultiIssueTemplate(), {
      structure: false,
    });

    expect(namespaces(issues)).toEqual(new Set(["a11y", "link"]));
    expect(issues.some((i) => i.ruleId.startsWith("structure."))).toBe(false);
  });

  it("forwards per-category options to the underlying linter", () => {
    const content = buildMultiIssueTemplate();

    // A severity override on an accessibility rule must reach lintAccessibility.
    const issues = lintTemplate(content, {
      accessibility: { rules: { "a11y.img-missing-alt": "off" } },
    });

    expect(issues.some((i) => i.ruleId === "a11y.img-missing-alt")).toBe(false);
    // Other categories are untouched.
    expect(issues.some((i) => i.ruleId === "link.javascript-protocol")).toBe(
      true,
    );
  });
});
