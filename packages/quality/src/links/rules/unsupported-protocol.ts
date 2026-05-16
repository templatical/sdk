import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.unsupported-protocol",
  severity: "warning",
};

const SUPPORTED = new Set(["http", "https", "mailto", "tel", "sms"]);

/**
 * Treat `javascript:` (covered by its own rule) and bare/relative URLs as
 * "not unsupported" — this rule fires only for explicitly named schemes that
 * email clients typically refuse.
 */
function getProtocol(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = /^([a-z][a-z0-9+\-.]*):/i.exec(trimmed);
  if (!match) return null;
  return match[1].toLowerCase();
}

export const unsupportedProtocol: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      const protocol = getProtocol(occ.url);
      if (protocol === null) continue;
      if (protocol === "javascript") continue;
      if (SUPPORTED.has(protocol)) continue;
      hits.push({ blockId: occ.blockId, params: { protocol } });
    }
    return hits;
  },
};
