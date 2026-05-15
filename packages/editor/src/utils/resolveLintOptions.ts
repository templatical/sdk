import type { LintOptions } from "@templatical/quality";

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
}): LintOptions {
  return {
    ...config.lint,
    locale: config.locale,
  };
}
