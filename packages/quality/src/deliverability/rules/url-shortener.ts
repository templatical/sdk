import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";
import { normalizedHost, parseHttpUrl } from "../same-site";

export const meta: RuleMeta = {
  id: "deliverability.url-shortener",
  severity: "warning",
};

export const urlShortener: Rule = {
  meta,
  template(content, opts): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      const url = parseHttpUrl(occ.url);
      if (!url) continue;
      const host = normalizedHost(url);
      if (
        opts.deliverability.shortenerHosts.some(
          (entry) => host === entry || host.endsWith(`.${entry}`),
        )
      ) {
        hits.push({ blockId: occ.blockId, params: { host } });
      }
    }
    return hits;
  },
};
