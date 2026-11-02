import {
  defaultLocaleOf,
  resolveLocale,
  type TemplateContent,
} from "@templatical/types";
import type { LintIssue, LintOptions } from "../types";
import { resolveOptions, runRules } from "../run-rules";
import {
  formatLocalizationMessage,
  type LocalizationRuleMessageId,
} from "./messages";
import { LOCALIZATION_RULES } from "./rules";

export { LOCALIZATION_RULES } from "./rules";

export function lintLocalization(
  content: TemplateContent,
  options: LintOptions = {},
): LintIssue[] {
  if (options.disabled === true || options.localization === false) return [];
  const contentLocale = options.contentLocale ?? defaultLocaleOf(content);
  if (contentLocale === defaultLocaleOf(content)) return [];
  // Standalone callers get the same unknown_locale refusal as lintTemplate.
  if (!content.settings.locales?.includes(contentLocale))
    resolveLocale(content, contentLocale);
  const resolved = {
    ...resolveOptions({
      locale: options.locale,
      rules: LOCALIZATION_RULES,
      overrides: options.localization?.rules,
      thresholds: undefined,
      nonProductionHosts: undefined,
    }),
    contentLocale,
    customBlocks: options.customBlocks,
    mergeTagSyntax: options.mergeTagSyntax,
  };
  return runRules(content, LOCALIZATION_RULES, resolved, (locale, id, params) =>
    formatLocalizationMessage(locale, id as LocalizationRuleMessageId, params),
  );
}
