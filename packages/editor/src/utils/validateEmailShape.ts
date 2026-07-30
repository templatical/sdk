/**
 * Characters that cannot appear in a domain but routinely arrive attached to one.
 *
 * A **denylist**, not an allowlist, so unicode domains keep working — an
 * allowlist of `[a-z0-9.-]` would be the stricter, more obviously "correct"
 * choice and would reject them. What this actually targets is the punctuation
 * that comes from pasting out of a list or a mail client: `user@example.com,`
 * and `<user@example.com>`.
 */
const IMPOSSIBLE_DOMAIN_CHARS = /[,;<>()[\]\\"'`|/?#@!$%^&*+=~{}]/;

/**
 * Does this string look like an email address?
 *
 * Deliberately loose: non-empty, no whitespace, exactly one `@`, a non-empty
 * local part, and a domain containing a dot with something either side and no
 * impossible characters. That is enough to catch the mistakes a typo actually
 * produces — a missing `@`, a trailing comma, a half-typed domain — before the
 * user pays for a round-trip.
 *
 * **Do not "improve" this into an RFC-ish regex.** Those reliably reject valid
 * addresses (plus-addressing, long new gTLDs, unicode domains) and the resulting
 * bug reports cost far more than the malformed addresses they catch. Only the
 * receiving mail server can really tell, and the sending backend has to validate
 * anyway — this is a fast-feedback affordance, not a gate. `validateEmailShape`
 * has its own test file pinning the addresses that must keep passing.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (/\s/.test(trimmed)) return false;

  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (local.length === 0) return false;
  if (IMPOSSIBLE_DOMAIN_CHARS.test(domain)) return false;

  // A dot with at least one character either side, so `a@b` and `a@b.` fail but
  // `a@b.c` and `a@sub.example.museum` pass.
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}
