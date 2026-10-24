import type { AiFixFinding } from "@templatical/types";
import type { LintOptions, LintIssue } from "@templatical/quality";

/** Lint rules whose findings get "Fix with AI" (A1 amendment R3). */
export const AI_FIXABLE_RULES = [
  "a11y.link-vague-text",
  "a11y.button-vague-label",
  "a11y.link-empty",
  "a11y.text-all-caps",
  "a11y.missing-preheader",
  "deliverability.link-text-domain-mismatch",
  "deliverability.low-text",
] as const;

/** Lint rules whose findings get "Write alt text" (A1 amendment R4). */
export const AI_ALT_TEXT_RULES = [
  "a11y.img-missing-alt",
  "a11y.img-alt-is-filename",
  "a11y.img-alt-too-long",
  "a11y.img-linked-no-context",
] as const;

/** Copy only the serializable lint diagnostic that the AI contract accepts. */
export function toAiFixFinding(issue: LintIssue): AiFixFinding {
  return {
    ruleId: issue.ruleId,
    message: issue.message,
    suggestion: issue.suggestion,
    reference: issue.reference,
    blockId: issue.blockId,
    ...(issue.excerpt !== undefined ? { excerpt: issue.excerpt } : {}),
  };
}

/** Quality's default, pinned by aiFixableRules.test.ts without an eager runtime import. */
export const DEFAULT_ALT_MAX_LENGTH = 125;

export function effectiveAltMaxLength(lint: LintOptions | undefined): number {
  const accessibility = lint?.accessibility;
  const value =
    accessibility !== null && typeof accessibility === "object"
      ? accessibility.thresholds?.altMaxLength
      : undefined;
  return lint?.disabled !== true &&
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 1000
    ? value
    : DEFAULT_ALT_MAX_LENGTH;
}
