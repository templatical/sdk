import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions, Rule } from "../types";
import { runRules } from "../run-rules";
import {
  formatStructureMessage,
  type StructureRuleMessageId,
} from "./messages";
import { duplicateBlockId } from "./rules/duplicate-block-id";
import { emptyColumn } from "./rules/empty-column";
import { emptySection } from "./rules/empty-section";
import { nestedSection } from "./rules/nested-section";
import { sectionColumnMismatch } from "./rules/section-column-mismatch";

export const STRUCTURE_RULES: Rule[] = [
  duplicateBlockId,
  emptySection,
  emptyColumn,
  nestedSection,
  sectionColumnMismatch,
];

export function lintStructure(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  return runRules(content, STRUCTURE_RULES, options, (locale, id, params) =>
    formatStructureMessage(locale, id as StructureRuleMessageId, params),
  );
}
