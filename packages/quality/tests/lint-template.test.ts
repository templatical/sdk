import { describe, expect, it, vi } from "vitest";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  type TemplateContent,
} from "@templatical/types";
import {
  lintAccessibility,
  lintDeliverability,
  lintLinks,
  lintStructure,
  lintTemplate,
  isLintFullyDisabled,
} from "../src";

vi.mock("../src/deliverability", () => ({
  lintDeliverability: (content: TemplateContent, options: { disabled?: boolean; deliverability?: false } = {}) =>
    options.disabled || options.deliverability === false || content.blocks.length === 0
      ? []
      : [{ blockId: null, ruleId: "deliverability.low-text", severity: "info", message: "stub" }],
  DELIVERABILITY_RULES: [],
}));

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
  it("returns the concatenation of every linter in category order", () => {
    const content = buildMultiIssueTemplate();

    const expected = [
      ...lintAccessibility(content),
      ...lintStructure(content),
    ...lintLinks(content),
    ...lintDeliverability(content),
    ];

    expect(fingerprint(lintTemplate(content))).toEqual(fingerprint(expected));
  });

  it("surfaces issues from all four linter categories at once", () => {
    const issues = lintTemplate(buildMultiIssueTemplate());

    expect(namespaces(issues)).toEqual(new Set(["a11y", "structure", "link", "deliverability"]));
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
      deliverability: false,
    });
    expect(issues).toEqual([]);
  });

  it("skips only the category turned off, keeping the rest", () => {
    const issues = lintTemplate(buildMultiIssueTemplate(), {
      structure: false,
    });

    expect(namespaces(issues)).toEqual(new Set(["a11y", "link", "deliverability"]));
    expect(issues.some((i) => i.ruleId.startsWith("structure."))).toBe(false);
  });

  it("keeps deliverability on unless explicitly disabled", () => {
    const content = buildMultiIssueTemplate();
    const threeOff = { accessibility: false, structure: false, links: false } as const;
    expect(isLintFullyDisabled(threeOff)).toBe(false);
    expect(lintTemplate(content, threeOff).map((issue) => issue.ruleId)).toEqual([
      "deliverability.low-text",
    ]);
    expect(isLintFullyDisabled({ ...threeOff, deliverability: false })).toBe(true);
    expect(isLintFullyDisabled({ disabled: true })).toBe(true);
    expect(lintTemplate(content, { deliverability: false }).some((issue) =>
      issue.ruleId.startsWith("deliverability."),
    )).toBe(false);
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
