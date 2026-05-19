import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions, Rule } from "../types";
import { resolveAccessibilityOptions, runRules } from "../run-rules";
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
import { linkNestedAnchor } from "./rules/link-nested-anchor";
import { textAllCaps } from "./rules/text-all-caps";
import { textLowContrast } from "./rules/text-low-contrast";
import { textTooSmall } from "./rules/text-too-small";
import { buttonVagueLabel } from "./rules/button-vague-label";
import { buttonTouchTarget } from "./rules/button-touch-target";
import { buttonLowContrast } from "./rules/button-low-contrast";
import { missingPreheader } from "./rules/missing-preheader";

export const ACCESSIBILITY_RULES: Rule[] = [
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
  linkNestedAnchor,
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
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.accessibility === false) return [];
  const tool = options.accessibility ?? {};
  const resolved = resolveAccessibilityOptions(
    options.locale,
    tool,
    ACCESSIBILITY_RULES,
  );
  return runRules(
    content,
    ACCESSIBILITY_RULES,
    resolved,
    (locale, id, params) => formatMessage(locale, id as RuleMessageId, params),
  );
}
