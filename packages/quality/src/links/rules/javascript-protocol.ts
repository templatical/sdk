import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.javascript-protocol",
  severity: "error",
};

/**
 * The set of URL schemes that can encode executable script or arbitrary
 * payloads inside an `href`/`src` value. All three are in scope for this
 * rule because a sanitizer that strips `javascript:` but leaves `data:` or
 * `vbscript:` through is the textbook "incomplete URL scheme check" bug.
 *
 * Rule ID stays `link.javascript-protocol` for back-compat with consumer
 * severity overrides; the message is parameterized so users see the actual
 * matched protocol.
 */
export const DANGEROUS_SCRIPT_PROTOCOLS = [
  "javascript",
  "data",
  "vbscript",
] as const;

type DangerousProtocol = (typeof DANGEROUS_SCRIPT_PROTOCOLS)[number];

/**
 * Match dangerous-script schemes even when the value is whitespace-padded or
 * mixed-case. Mirrors what HTML attribute parsers see at insert time —
 * leading whitespace (spaces, tabs, newlines) is stripped before scheme
 * parsing, and unicode-percent-encoded whitespace inside the scheme is
 * rejected by browsers, so a literal-strip is sufficient.
 */
function matchDangerousProtocol(url: string): DangerousProtocol | null {
  if (!url) return null;
  const stripped = url.replace(/\s+/g, "");
  for (const proto of DANGEROUS_SCRIPT_PROTOCOLS) {
    if (new RegExp(`^${proto}:`, "i").test(stripped)) return proto;
  }
  return null;
}

export const javascriptProtocol: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      const protocol = matchDangerousProtocol(occ.url);
      if (protocol !== null) {
        hits.push({ blockId: occ.blockId, params: { protocol } });
      }
    }
    return hits;
  },
};
