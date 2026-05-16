import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.malformed-tel",
  severity: "warning",
};

const VALID_SUBSCRIBER_CHARS = /^[+0-9\s().\-]+$/;
// RFC 3966 par = `;` pname [ "=" pvalue ]. pname is alphanum/`-`, pvalue is
// 1+ paramchar. We accept anything non-empty on the right of `=` since email
// clients don't validate it.
const VALID_PARAM = /^[A-Za-z0-9-]+(=[^;]+)?$/;

function isMalformedTel(url: string): boolean {
  const trimmed = url.trim();
  if (!/^tel:/i.test(trimmed)) return false;
  const value = trimmed.slice("tel:".length).trim();
  if (value === "") return true;
  const [subscriber, ...params] = value.split(";");
  if (!VALID_SUBSCRIBER_CHARS.test(subscriber)) return true;
  return params.some((p) => !VALID_PARAM.test(p));
}

export const malformedTel: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      if (isMalformedTel(occ.url)) {
        hits.push({ blockId: occ.blockId });
      }
    }
    return hits;
  },
};
