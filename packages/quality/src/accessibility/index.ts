import type { TemplateContent } from "@templatical/types";
import type {
  A11yIssue,
  A11yOptions,
  ResolvedOptions,
  Rule,
  RuleHit,
  Severity,
} from "../types";
import { DEFAULT_THRESHOLDS } from "../types";
import { walkBlocks } from "../walk";
import { formatMessage, type RuleMessageId } from "./messages";
import { imgMissingAlt } from "./rules/img-missing-alt";
import { imgAltIsFilename } from "./rules/img-alt-is-filename";
import { imgAltTooLong } from "./rules/img-alt-too-long";
import { imgDecorativeNeedsEmptyAlt } from "./rules/img-decorative-needs-empty-alt";
import { imgLinkedNoContext } from "./rules/img-linked-no-context";
import { headingEmpty } from "./rules/heading-empty";
import { headingSkipLevel } from "./rules/heading-skip-level";
import { headingMultipleH1 } from "./rules/heading-multiple-h1";
import { linkEmpty } from "./rules/link-empty";
import { linkVagueText } from "./rules/link-vague-text";
import { linkHrefEmpty } from "./rules/link-href-empty";
import { linkTargetBlankNoRel } from "./rules/link-target-blank-no-rel";
import { textAllCaps } from "./rules/text-all-caps";
import { textLowContrast } from "./rules/text-low-contrast";
import { textTooSmall } from "./rules/text-too-small";
import { buttonVagueLabel } from "./rules/button-vague-label";
import { buttonTouchTarget } from "./rules/button-touch-target";
import { buttonLowContrast } from "./rules/button-low-contrast";
import { missingPreheader } from "./rules/missing-preheader";

export const RULES: Rule[] = [
  imgMissingAlt,
  imgAltIsFilename,
  imgAltTooLong,
  imgDecorativeNeedsEmptyAlt,
  imgLinkedNoContext,
  headingEmpty,
  headingSkipLevel,
  headingMultipleH1,
  linkEmpty,
  linkVagueText,
  linkHrefEmpty,
  linkTargetBlankNoRel,
  textAllCaps,
  textLowContrast,
  textTooSmall,
  buttonVagueLabel,
  buttonTouchTarget,
  buttonLowContrast,
  missingPreheader,
];

export function lintAccessibility(
  content: TemplateContent,
  options: A11yOptions = {},
): A11yIssue[] {
  if (options.disabled === true) {
    return [];
  }

  const opts = resolveOptions(options);
  const issues: A11yIssue[] = [];

  function buildIssue(
    ruleId: string,
    severity: Exclude<Severity, "off">,
    hit: RuleHit,
  ): A11yIssue {
    return {
      blockId: hit.blockId,
      ruleId,
      severity,
      message: formatMessage(opts.locale, ruleId as RuleMessageId, hit.params),
      fix: hit.fix,
    };
  }

  walkBlocks(content, (block, ctx) => {
    for (const rule of RULES) {
      const sev = opts.severity(rule.meta.id);
      if (sev === "off" || !rule.block) continue;
      const hit = rule.block(block, ctx, opts);
      if (hit !== null) {
        issues.push(buildIssue(rule.meta.id, sev, hit));
      }
    }
  });

  for (const rule of RULES) {
    const sev = opts.severity(rule.meta.id);
    if (sev === "off" || !rule.template) continue;
    const hits = rule.template(content, opts);
    for (const hit of hits) {
      issues.push(buildIssue(rule.meta.id, sev, hit));
    }
  }

  return issues;
}

export function resolveOptions(options: A11yOptions): ResolvedOptions {
  const overrides = options.rules ?? {};
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };
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
      const rule = RULES.find((r) => r.meta.id === ruleId);
      return rule?.meta.severity ?? "warning";
    },
  };
}
