import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.malformed-tel",
  severity: "warning",
};

const VALID_TEL_CHARS = /^[+0-9\s().\-]+$/;

function isMalformedTel(url: string): boolean {
  const trimmed = url.trim();
  if (!/^tel:/i.test(trimmed)) return false;
  const value = trimmed.slice("tel:".length).trim();
  if (value === "") return true;
  return !VALID_TEL_CHARS.test(value);
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
