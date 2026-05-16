import type { Rule, RuleHit, RuleMeta } from "../../types";
import { walkUrls } from "../../url-walker";

export const meta: RuleMeta = {
  id: "link.malformed-mailto",
  severity: "warning",
};

/**
 * Pragmatic RFC-5321-ish sanity check, not a full validator. Splits on `?`,
 * requires the left side to contain exactly one `@` with a non-empty local
 * part and a domain that includes at least one dot.
 *
 * Multi-recipient `mailto:a@x.com,b@y.com` is accepted (commas pass through;
 * each recipient is validated individually).
 */
function isMalformedMailto(url: string): boolean {
  const trimmed = url.trim();
  if (!/^mailto:/i.test(trimmed)) return false;
  const value = trimmed.slice("mailto:".length);
  const [recipients] = value.split("?", 2);
  if (recipients.trim() === "") return true;

  const list = recipients.split(",").map((r) => r.trim());
  for (const recipient of list) {
    if (recipient === "") return true;
    const at = recipient.split("@");
    if (at.length !== 2) return true;
    const [local, domain] = at;
    if (local === "" || domain === "") return true;
    if (!domain.includes(".")) return true;
  }
  return false;
}

export const malformedMailto: Rule = {
  meta,
  template(content): RuleHit[] {
    const hits: RuleHit[] = [];
    for (const occ of walkUrls(content)) {
      if (isMalformedMailto(occ.url)) {
        hits.push({ blockId: occ.blockId });
      }
    }
    return hits;
  },
};
