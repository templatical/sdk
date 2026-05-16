import type { ResolvedOptions, Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.localhost-or-staging",
  severity: "warning",
};

/**
 * Glob → RegExp for the `nonProductionHosts` pattern set. `*` is a wildcard
 * that matches any run of characters (including `.`) so `*.staging.*`
 * matches `app.staging.example.com` and `*.local` matches both `acme.local`
 * and `a.b.c.local`. Case-insensitive.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const expanded = escaped.replace(/\*/g, ".*");
  return new RegExp(`^${expanded}$`, "i");
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
    const regexes = patterns.map(globToRegex);
    const hits: RuleHit[] = [];

    for (const occ of walkUrls(content)) {
      const host = extractHost(occ.url);
      if (host === null) continue;
      if (regexes.some((re) => re.test(host))) {
        hits.push({ blockId: occ.blockId, params: { host } });
      }
    }
    return hits;
  },
};
