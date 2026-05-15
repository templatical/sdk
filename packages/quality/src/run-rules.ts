import type { TemplateContent } from "@templatical/types";
import type {
  LintIssue,
  LintOptions,
  ResolvedOptions,
  Rule,
  RuleHit,
  Severity,
} from "./types";
import { DEFAULT_A11Y_THRESHOLDS } from "./types";
import { walkBlocks } from "./walk";

export type MessageFormatter = (
  locale: string,
  ruleId: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Walk the tree once, dispatch every block-level rule, then run every
 * template-level rule. Each tool (lintAccessibility, lintStructure, …)
 * wraps this with its own rule list + message formatter. Keeps the per-tool
 * orchestrators down to a thin call.
 */
export function runRules(
  content: TemplateContent,
  rules: Rule[],
  options: LintOptions,
  formatMessage: MessageFormatter,
): LintIssue[] {
  if (options.disabled === true) {
    return [];
  }

  const opts = resolveOptions(options, rules);
  const issues: LintIssue[] = [];

  function buildIssue(
    ruleId: string,
    severity: Exclude<Severity, "off">,
    hit: RuleHit,
  ): LintIssue {
    return {
      blockId: hit.blockId,
      ruleId,
      severity,
      message: formatMessage(opts.locale, ruleId, hit.params),
      fix: hit.fix,
    };
  }

  walkBlocks(content, (block, ctx) => {
    for (const rule of rules) {
      const sev = opts.severity(rule.meta.id);
      if (sev === "off" || !rule.block) continue;
      const hit = rule.block(block, ctx, opts);
      if (hit !== null) {
        issues.push(buildIssue(rule.meta.id, sev, hit));
      }
    }
  });

  for (const rule of rules) {
    const sev = opts.severity(rule.meta.id);
    if (sev === "off" || !rule.template) continue;
    const hits = rule.template(content, opts);
    for (const hit of hits) {
      issues.push(buildIssue(rule.meta.id, sev, hit));
    }
  }

  return issues;
}

export function resolveOptions(
  options: LintOptions,
  rules: Rule[],
): ResolvedOptions {
  const overrides = options.rules ?? {};
  const thresholds = {
    ...DEFAULT_A11Y_THRESHOLDS,
    ...(options.thresholds ?? {}),
  };
  const locale = options.locale ?? "en";

  return {
    locale,
    rules: overrides,
    thresholds,
    severity: (ruleId: string): Severity => {
      const override = overrides[ruleId];
      if (override !== undefined) {
        return override;
      }
      const rule = rules.find((r) => r.meta.id === ruleId);
      return rule?.meta.severity ?? "warning";
    },
  };
}
