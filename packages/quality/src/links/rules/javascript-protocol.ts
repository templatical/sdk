import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.javascript-protocol",
  severity: "error",
};

/**
 * Match `javascript:` even when the value is whitespace-padded or mixed-case.
 * Mirrors what HTML attribute parsers see at insert time — leading whitespace
 * (spaces, tabs, newlines) is stripped before scheme parsing.
 */
function isJavascriptProtocol(url: string): boolean {
  if (!url) return false;
  const stripped = url.replace(/\s+/g, "");
  return /^javascript:/i.test(stripped);
}

export const javascriptProtocol: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      if (isJavascriptProtocol(occ.url)) {
        hits.push({ blockId: occ.blockId });
      }
    }
    return hits;
  },
};
