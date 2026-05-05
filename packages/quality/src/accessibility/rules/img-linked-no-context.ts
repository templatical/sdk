import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getDictionary } from "../dictionaries";

export const meta: RuleMeta = {
  id: "img-linked-no-context",
  severity: "warning",
};

export const imgLinkedNoContext: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isImage(block) || block.decorative === true) return null;
    if (!block.linkUrl || block.linkUrl.trim() === "") return null;
    const alt = (block.alt ?? "").trim();
    if (alt === "") return null;
    const tokens = alt
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const hints = getDictionary(opts.locale).linkedImageActionHints;
    if (tokens.some((token) => hints.includes(token))) return null;
    return { blockId: block.id };
  },
};
