import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";
import { DANGEROUS_SCRIPT_PROTOCOLS } from "./javascript-protocol";

export const meta: RuleMeta = {
  id: "link.unsupported-protocol",
  severity: "warning",
};

const SUPPORTED = new Set(["http", "https", "mailto", "tel", "sms"]);
const DANGEROUS = new Set<string>(DANGEROUS_SCRIPT_PROTOCOLS);

/**
 * Treat dangerous-script schemes (covered by `link.javascript-protocol`) and
 * bare/relative URLs as "not unsupported" — this rule fires only for
 * explicitly named schemes that email clients typically refuse.
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
      if (DANGEROUS.has(protocol)) continue;
      if (SUPPORTED.has(protocol)) continue;
      hits.push({ blockId: occ.blockId, params: { protocol } });
    }
    return hits;
  },
};
