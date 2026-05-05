import type { A11yOptions } from "@templatical/quality";

/**
 * Build the `A11yOptions` object the editor passes to the lint composable.
 *
 * In editor / cloud-editor mode the linter locale is forced to match the
 * editor UI locale — `accessibility.locale` set by the consumer is
 * ignored. Headless callers (`lintAccessibility(...)` directly) keep
 * full control.
 */
export function resolveAccessibilityOptions(config: {
  locale?: string;
  accessibility?: A11yOptions;
}): A11yOptions {
  return {
    ...config.accessibility,
    locale: config.locale,
  };
}
