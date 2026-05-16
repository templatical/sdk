import type { LintOptions } from "./types";

/**
 * `true` when no linter would run for the given options — either the
 * global `disabled` flag is set, or every per-tool key is `false`.
 *
 * The editor uses this to skip lazy-loading `@templatical/quality`, hide
 * the Issues sidebar tab, and suppress inline canvas badges. Headless
 * callers can use it to short-circuit before any linter call.
 */
export function isLintFullyDisabled(options: LintOptions | undefined): boolean {
  if (!options) return false;
  if (options.disabled === true) return true;
  return (
    options.accessibility === false &&
    options.structure === false &&
    options.links === false
  );
}
