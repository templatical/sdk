import type { LintOptions } from "@templatical/quality";
import type { TemplateContent } from "@templatical/types";

/**
 * Build the `LintOptions` object the editor passes to the lint composable.
 *
 * In editor / cloud-editor mode the linter locale is forced to match the
 * editor UI locale — `lint.locale` set by the consumer is ignored.
 * Headless callers (`lintAccessibility(...)` / `lintStructure(...)` directly)
 * keep full control.
 */
export function resolveLintOptions(config: {
  locale?: string;
  lint?: LintOptions;
  contentLocale?: string;
  content?: Pick<TemplateContent, "settings">;
}): LintOptions {
  const contentLocale = config.contentLocale ?? config.content?.settings.locale;
  return {
    ...config.lint,
    locale: config.locale,
    ...(contentLocale !== undefined ? { contentLocale } : {}),
  };
}
