import { describe, expect, it, vi } from "vitest";
import {
  ACCESSIBILITY_RULES,
  DEFAULT_A11Y_THRESHOLDS,
  DELIVERABILITY_RULES,
  type LintIssue,
} from "@templatical/quality";
import {
  AI_ALT_TEXT_RULES,
  DEFAULT_ALT_MAX_LENGTH,
  effectiveAltMaxLength,
  AI_FIXABLE_RULES,
  toAiFixFinding,
} from "../src/utils/aiFixableRules";

describe("AI lint rule projection", () => {
  it("offers only rule ids that quality actually emits", () => {
    const ids = [...ACCESSIBILITY_RULES, ...DELIVERABILITY_RULES].map(
      (rule) => rule.meta.id,
    );
    for (const id of [...AI_FIXABLE_RULES, ...AI_ALT_TEXT_RULES])
      expect(ids).toContain(id);
    expect(AI_FIXABLE_RULES).toHaveLength(7);
    expect(AI_ALT_TEXT_RULES).toHaveLength(4);
  });

  it("copies only diagnostic fields, without mutating or sending local metadata", () => {
    const issue: LintIssue = {
      ruleId: "deliverability.link-text-domain-mismatch",
      message: "Wrong domain.",
      suggestion: "Use descriptive words.",
      reference: "https://docs.templatical.com/quality/",
      blockId: "p1",
      excerpt: "example.org",
      severity: "warning",
      clients: [],
      fix: { description: "Fix", apply: vi.fn() },
    };
    const projected = toAiFixFinding(issue);
    expect(projected).toEqual({
      ruleId: "deliverability.link-text-domain-mismatch",
      message: "Wrong domain.",
      suggestion: "Use descriptive words.",
      reference: "https://docs.templatical.com/quality/",
      blockId: "p1",
      excerpt: "example.org",
    });
    expect(projected).not.toBe(issue);
    expect(issue.fix).toBeDefined();
    const { excerpt: _excerpt, ...withoutExcerpt } = issue;
    expect(toAiFixFinding(withoutExcerpt)).not.toHaveProperty("excerpt");
  });
});

describe("effectiveAltMaxLength", () => {
  it("matches quality's default without a runtime dependency", () => {
    expect(DEFAULT_ALT_MAX_LENGTH).toBe(DEFAULT_A11Y_THRESHOLDS.altMaxLength);
    expect(DEFAULT_ALT_MAX_LENGTH).toBe(125);
  });
  it.each([1, 60, 1000])("takes the configured integer %s", value => {
    expect(effectiveAltMaxLength({ accessibility: { thresholds: { altMaxLength: value } } })).toBe(value);
  });
  it.each([undefined, {}, { accessibility: null }, { disabled: true, accessibility: { thresholds: { altMaxLength: 60 } } }, { accessibility: false }, { accessibility: true }, { accessibility: {} }, ...[0, 1001, 2.5, NaN, Infinity, "60"].map(altMaxLength => ({ accessibility: { thresholds: { altMaxLength } } }))])("falls back for %j", lint => {
    expect(effectiveAltMaxLength(lint as never)).toBe(125);
  });
});
