import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions } from "../../../quality/src/types";

export function lintTemplate(
  content: TemplateContent,
  options?: LintOptions,
): LintIssue[];
