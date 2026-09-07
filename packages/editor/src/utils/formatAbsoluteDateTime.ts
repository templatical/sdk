/**
 * An absolute date/time label in the **editor's** locale.
 *
 * `toLocaleString()` and `toLocaleDateString(undefined, …)` format in the
 * *runtime's* locale, which is the browser's or the OS's — not the one the
 * consumer passed to `init({ locale })`. So a German editor opened in an
 * English browser rendered "Mar 4, 2026" beside fully German chrome, and an
 * English editor in a German browser did the mirror image. The editor's own
 * locale is the only one that agrees with the surrounding labels.
 *
 * Two guards, both reachable from consumer input:
 *
 *  - **A malformed tag makes `Intl` throw `RangeError`.** `config.locale` is
 *    free-text config, so `"not a locale"` would take down the whole component
 *    render for what is a cosmetic tooltip. Falls back to the runtime locale —
 *    the behaviour before this existed — rather than to a hardcoded language.
 *    A well-formed but *unregistered* tag (`"zz"`) is not caught: `Intl`
 *    resolves its own fallback, and second-guessing it would be worse.
 *  - **An unparseable date yields `""`.** Every caller renders this into a
 *    `title` attribute, where a literal "Invalid Date" is worse than no
 *    tooltip.
 */
export function formatAbsoluteDateTime(
  iso: string,
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";

  const tag = locale?.trim().replace(/_/g, "-") || undefined;

  try {
    return parsed.toLocaleString(tag, options);
  } catch {
    // RangeError from a malformed tag — format as we did before a locale was
    // threaded through at all.
    return parsed.toLocaleString(undefined, options);
  }
}
