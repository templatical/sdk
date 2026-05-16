import type { TemplateContent } from "@templatical/types";
import type {
  AccessibilityLintOptions,
  LinksLintOptions,
  LintIssue,
  ResolvedOptions,
  Rule,
  RuleHit,
  RuleOverrides,
  Severity,
  StructureLintOptions,
} from "./types";
import { DEFAULT_A11Y_THRESHOLDS, DEFAULT_NON_PRODUCTION_HOSTS } from "./types";
import { walkBlocks } from "./walk";

export type MessageFormatter = (
  locale: string,
  ruleId: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Walk the tree once, dispatch every block-level rule, then run every
 * template-level rule. Each tool (lintAccessibility, lintStructure, …)
 * wraps this with its own rule list + message formatter and a pre-built
 * `ResolvedOptions` containing that tool's overrides and tool-scoped config.
 */
export function runRules(
  content: TemplateContent,
  rules: Rule[],
  opts: ResolvedOptions,
  formatMessage: MessageFormatter,
): LintIssue[] {
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

/**
 * Build a `ResolvedOptions` for a given tool. Each tool wrapper passes its
 * own per-tool bag; fields not relevant to the tool fall back to defaults
 * (e.g. `lintStructure` still gets `thresholds` populated, but no structure
 * rule reads them).
 */
export function resolveOptions(args: {
  locale: string | undefined;
  rules: Rule[];
  overrides: RuleOverrides | undefined;
  thresholds: Partial<import("./types").LintThresholds> | undefined;
  nonProductionHosts: string[] | undefined;
}): ResolvedOptions {
  const overrides = args.overrides ?? {};
  const thresholds = {
    ...DEFAULT_A11Y_THRESHOLDS,
    ...(args.thresholds ?? {}),
  };
  const links = {
    nonProductionHosts: args.nonProductionHosts ?? DEFAULT_NON_PRODUCTION_HOSTS,
  };
  const locale = args.locale ?? "en";
  const rules = args.rules;

  return {
    locale,
    rules: overrides,
    thresholds,
    links,
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

/**
 * Resolver for the accessibility linter — reads `options.accessibility`.
 */
export function resolveAccessibilityOptions(
  locale: string | undefined,
  tool: AccessibilityLintOptions,
  rules: Rule[],
): ResolvedOptions {
  return resolveOptions({
    locale,
    rules,
    overrides: tool.rules,
    thresholds: tool.thresholds,
    nonProductionHosts: undefined,
  });
}

/**
 * Resolver for the structure linter — reads `options.structure`.
 */
export function resolveStructureOptions(
  locale: string | undefined,
  tool: StructureLintOptions,
  rules: Rule[],
): ResolvedOptions {
  return resolveOptions({
    locale,
    rules,
    overrides: tool.rules,
    thresholds: undefined,
    nonProductionHosts: undefined,
  });
}

/**
 * Resolver for the links linter — reads `options.links`.
 */
export function resolveLinksOptions(
  locale: string | undefined,
  tool: LinksLintOptions,
  rules: Rule[],
): ResolvedOptions {
  return resolveOptions({
    locale,
    rules,
    overrides: tool.rules,
    thresholds: undefined,
    nonProductionHosts: tool.nonProductionHosts,
  });
}
