import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";
import { DANGEROUS_SCRIPT_SCHEMES, extractUrlScheme } from "@templatical/types";

export const meta: RuleMeta = {
  id: "link.javascript-protocol",
  reference:
    "https://docs.templatical.com/quality/links/rule-catalog#dangerous-protocols",
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
export const DANGEROUS_SCRIPT_PROTOCOLS = DANGEROUS_SCRIPT_SCHEMES;

type DangerousProtocol = (typeof DANGEROUS_SCRIPT_PROTOCOLS)[number];

/**
 * Match dangerous-script schemes after the shared browser-style URL
 * normalization, including embedded tab/LF/CR and leading C0 controls. Keep
 * the rule's older conservative Unicode-whitespace warning for authoring.
 */
function matchDangerousProtocol(url: string): DangerousProtocol | null {
  const scheme = extractUrlScheme(url);
  const legacyScheme = extractUrlScheme(url.replace(/\s+/g, ""));
  return (
    DANGEROUS_SCRIPT_PROTOCOLS.find(
      (proto) => proto === scheme || proto === legacyScheme,
    ) ?? null
  );
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
