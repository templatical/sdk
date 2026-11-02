import type { TemplateContent } from "@templatical/types";
import { defaultLocaleOf, resolveLocale } from "@templatical/types";
import type { LintIssue, LintOptions } from "./types";
import { lintAccessibility } from "./accessibility";
import { lintStructure } from "./structure";
import { lintLinks } from "./links";
import { lintDeliverability } from "./deliverability";
import { lintCompatibility } from "./compatibility";
import { lintLocalization } from "./localization";
import { isLintFullyDisabled } from "./util";

/**
 * Run every linter in the package — accessibility, structure, links,
 * deliverability, compatibility, and localization —
 * against `content` and return the merged issue list.
 *
 * This is the single entry point callers should prefer. CI guards, the
 * editor's live linter, and headless consumers all funnel through here, so
 * a new linter category is picked up everywhere by registering it in this
 * one fan-out — no consumer has to learn about the new function.
 *
 * Per-category options (`options.accessibility`, `options.structure`,
 * `options.links`, `options.deliverability`, `options.compatibility`,
 * `options.localization`) and the
 * global `options.disabled` flag are forwarded
 * unchanged; each sub-linter already short-circuits when its category is
 * `false`, so the per-tool calls below are cheap no-ops when disabled.
 *
 * Issue order is stable: accessibility, structure, links, deliverability,
 * compatibility, localization. `contentLocale` selects the projection;
 * `locale` selects messages. Vague-text dictionaries remain a union.
 * Removal fixes are omitted for non-default languages because they change
 * the shared tree; patch fixes remain available for language-layer edits.
 */
export function lintTemplate(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (isLintFullyDisabled(options)) return [];
  const defaultLocale = defaultLocaleOf(content);
  const contentLocale = options.contentLocale ?? defaultLocale;
  const projected = resolveLocale(content, contentLocale);
  const issues = [
    ...lintAccessibility(projected, options),
    ...lintStructure(projected, options),
    ...lintLinks(projected, options),
    ...lintDeliverability(projected, options),
    ...lintCompatibility(projected, options),
    ...lintLocalization(content, options),
  ];
  if (contentLocale === defaultLocale) return issues;
  return issues.map((issue) => {
    if (!issue.fix?.removesBlock) return issue;
    const withoutFix = { ...issue };
    delete withoutFix.fix;
    return withoutFix;
  });
}
