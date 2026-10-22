import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions, Rule } from "../types";
import { resolveDeliverabilityOptions, runRules } from "../run-rules";
import {
  formatDeliverabilityMessage,
  type DeliverabilityRuleMessageId,
} from "./messages";
import { linkTextDomainMismatch } from "./rules/link-text-domain-mismatch";
import { urlShortener } from "./rules/url-shortener";
import { ipAddressUrl } from "./rules/ip-address-url";
import { lowText } from "./rules/low-text";

export const DELIVERABILITY_RULES: Rule[] = [
  linkTextDomainMismatch,
  urlShortener,
  ipAddressUrl,
  lowText,
];

export function lintDeliverability(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.deliverability === false) return [];
  const tool = options.deliverability ?? {};
  const resolved = resolveDeliverabilityOptions(
    options.locale,
    tool,
    DELIVERABILITY_RULES,
  );
  return runRules(
    content,
    DELIVERABILITY_RULES,
    resolved,
    (locale, id, params) =>
      formatDeliverabilityMessage(
        locale,
        id as DeliverabilityRuleMessageId,
        params,
      ),
  );
}
