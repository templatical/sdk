/**
 * An absolute date label in the **host's** locale.
 *
 * `toLocaleDateString(undefined, …)` formats in the *runtime's* locale — the
 * browser's or the OS's — not the one that reached this package as
 * `MediaLibraryModal`'s `locale` prop. So the library's captions read in the
 * browser's language while every string around them was translated from the
 * editor's `init({ locale })`.
 *
 * Two guards, both reachable from consumer input:
 *
 *  - **A malformed tag makes `Intl` throw `RangeError`.** The locale originates
 *    in the host's free-text config, so a bad value would take down the grid
 *    for a caption. Falls back to the runtime locale — the behaviour before a
 *    locale was threaded through at all — rather than to a hardcoded language.
 *    A well-formed but *unregistered* tag (`"zz"`) is not caught: `Intl`
 *    resolves its own fallback.
 *  - **An unparseable date yields `""`**, never a literal "Invalid Date".
 *
 * A deliberate twin of `formatAbsoluteDateTime` in `@templatical/editor`. They
 * are copies, not a shared module: this package cannot import from the editor
 * (the dependency runs the other way) and `@templatical/types` is the
 * dependency-free leaf rather than a home for display helpers. Behavioural
 * drift between them fails `tests/formatAbsoluteDate.test.ts`, which carries
 * the editor suite's own cases.
 */
export function formatAbsoluteDate(
  iso: string,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const tag = locale?.trim().replace(/_/g, "-") || undefined;

  try {
    return parsed.toLocaleDateString(tag, options);
  } catch {
    return parsed.toLocaleDateString(undefined, options);
  }
}
