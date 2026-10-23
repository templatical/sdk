import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";
import { normalizedHost, parseHttpUrl } from "../same-site";

export const meta: RuleMeta = {
  id: "deliverability.ip-address-url",
  reference:
    "https://svn.apache.org/repos/asf/spamassassin/branches/b2_4_0/rules/20_uri_tests.cf",
  severity: "warning",
};

export const ipAddressUrl: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      const url = parseHttpUrl(occ.url);
      if (!url) continue;
      const host = normalizedHost(url);
      const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
      const ipv6 = host.startsWith("[") && host.endsWith("]");
      if (!ipv4 && !ipv6) continue;
      if (host.startsWith("127.") || host === "0.0.0.0" || host === "[::1]")
        continue;
      hits.push({ blockId: occ.blockId, params: { host } });
    }
    return hits;
  },
};
