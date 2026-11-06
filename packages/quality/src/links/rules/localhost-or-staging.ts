import type { ResolvedOptions, Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.localhost-or-staging",
  reference:
    "https://docs.templatical.com/quality/links/rule-catalog#environment-leaks",
  severity: "warning",
};

/**
 * Match a `nonProductionHosts` glob. `*` is a wildcard
 * that matches any run of characters (including `.`) so `*.staging.*`
 * matches `app.staging.example.com` and `*.local` matches both `acme.local`
 * and `a.b.c.local`. Case-insensitive.
 */
export function matchesHostGlob(pattern: string, host: string): boolean {
  const segments = pattern.toLowerCase().split("*");
  if (segments.length === 1) return host === segments[0];

  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!host.startsWith(first) || !host.endsWith(last)) return false;
  const lastStart = host.length - last.length;
  let position = first.length;
  if (position > lastStart) return false;

  for (let i = 1; i < segments.length - 1; i++) {
    const segment = segments[i];
    const found = host.indexOf(segment, position);
    if (found === -1 || found + segment.length > lastStart) return false;
    position = found + segment.length;
  }
  return true;
}

function extractHost(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // mailto/tel/sms have no host concept worth matching.
  if (!/^(https?|ftps?):\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const localhostOrStaging: Rule = {
  meta,
  template(content, opts: ResolvedOptions): RuleHit[] {
    const patterns = opts.links.nonProductionHosts;
    if (patterns.length === 0) return [];
    const hits: RuleHit[] = [];

    for (const occ of walkUrls(content)) {
      const host = extractHost(occ.url);
      if (host === null) continue;
      if (patterns.some((pattern) => matchesHostGlob(pattern, host))) {
        hits.push({ blockId: occ.blockId, params: { host } });
      }
    }
    return hits;
  },
};
