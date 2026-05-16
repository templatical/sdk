import type { TemplateContent } from "@templatical/types";
import type { LintIssue, LintOptions, Rule } from "../types";
import { resolveLinksOptions, runRules } from "../run-rules";
import { formatLinkMessage, type LinkRuleMessageId } from "./messages";
import { javascriptProtocol } from "./rules/javascript-protocol";
import { unsupportedProtocol } from "./rules/unsupported-protocol";
import { malformedMailto } from "./rules/malformed-mailto";
import { malformedTel } from "./rules/malformed-tel";
import { localhostOrStaging } from "./rules/localhost-or-staging";

export const LINK_RULES: Rule[] = [
  javascriptProtocol,
  unsupportedProtocol,
  malformedMailto,
  malformedTel,
  localhostOrStaging,
];

export function lintLinks(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.links === false) return [];
  const tool = options.links ?? {};
  const resolved = resolveLinksOptions(options.locale, tool, LINK_RULES);
  return runRules(content, LINK_RULES, resolved, (locale, id, params) =>
    formatLinkMessage(locale, id as LinkRuleMessageId, params),
  );
}
