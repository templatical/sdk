import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.relative-url",
  reference:
    "https://docs.templatical.com/quality/links/rule-catalog#unsupported-protocols",
  severity: "warning",
};

/**
 * Root-relative, `./` / `../` relative, query-only, and protocol-relative
 * (`//host`) URLs. A sent email has no page URL to resolve them against.
 *
 * Keyed on path-shaped prefixes only: the linter has no merge-tag syntax, so
 * "no scheme" would also match a URL that opens with a tag the sending system
 * completes (`{{ unsubscribe_url }}`).
 */
const RELATIVE_URL = /^(?:\/|\.{1,2}\/|\?)/;

export const relativeUrl: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      const url = occ.url?.trim();
      if (!url || !RELATIVE_URL.test(url)) continue;
      hits.push({ blockId: occ.blockId, params: { url } });
    }
    return hits;
  },
};
