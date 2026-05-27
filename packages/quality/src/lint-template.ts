import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions } from "./types";
import { lintAccessibility } from "./accessibility";
import { lintStructure } from "./structure";
import { lintLinks } from "./links";
import { isLintFullyDisabled } from "./util";

/**
 * Run every linter in the package — accessibility, structure, and links —
 * against `content` and return the merged issue list.
 *
 * This is the single entry point callers should prefer. CI guards, the
 * editor's live linter, and headless consumers all funnel through here, so
 * a new linter category is picked up everywhere by registering it in this
 * one fan-out — no consumer has to learn about the new function.
 *
 * Per-category options (`options.accessibility`, `options.structure`,
 * `options.links`) and the global `options.disabled` flag are forwarded
 * unchanged; each sub-linter already short-circuits when its category is
 * `false`, so the per-tool calls below are cheap no-ops when disabled.
 *
 * Issue order is stable: accessibility first, then structure, then links.
 */
export function lintTemplate(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (isLintFullyDisabled(options)) return [];
  return [
    ...lintAccessibility(content, options),
    ...lintStructure(content, options),
    ...lintLinks(content, options),
  ];
}
