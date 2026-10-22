import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";
import { isSameSite, normalizedHost, parseHttpUrl } from "../same-site";

export const meta: RuleMeta = {
  id: "deliverability.link-text-domain-mismatch",
  reference: "https://docs.rspamd.com/modules/phishing/",
  severity: "warning",
};

const DOMAIN_LABEL =
  /^(?:https?:\/\/)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:\p{L}{2,}|xn--[a-z0-9-]+)(?::\d+)?(?:[/?#][^\s]*)?$/iu;

function labelUrl(label: string | undefined): URL | null {
  if (!label) return null;
  let text = label.trim();
  if (text.startsWith("<") && text.endsWith(">")) text = text.slice(1, -1);
  text = text.replace(/[.,;:!?)]+$/, "");
  if (!DOMAIN_LABEL.test(text)) return null;
  return parseHttpUrl(/^https?:\/\//i.test(text) ? text : `http://${text}`);
}

export const linkTextDomainMismatch: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      if (
        occ.source !== "anchor" &&
        occ.source !== "button" &&
        occ.source !== "menu-item"
      )
        continue;
      const textUrl = labelUrl(occ.label);
      const linkUrl = parseHttpUrl(occ.url);
      if (!textUrl || !linkUrl) continue;
      const textHost = normalizedHost(textUrl);
      const linkHost = normalizedHost(linkUrl);
      if (!isSameSite(textHost, linkHost)) {
        hits.push({ blockId: occ.blockId, params: { textHost, linkHost } });
      }
    }
    return hits;
  },
};
