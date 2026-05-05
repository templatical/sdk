import { isParagraph, isTitle } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractText } from "../../html-utils";

export const meta: RuleMeta = {
  id: "text-all-caps",
  severity: "warning",
};

export const textAllCaps: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isParagraph(block) && !isTitle(block)) return null;
    const text = extractText(block.content ?? "");
    const letters = text.replace(/[^\p{L}]/gu, "");
    if (letters.length < opts.thresholds.allCapsMinLength) return null;
    if (letters !== letters.toLocaleUpperCase()) return null;
    return { blockId: block.id };
  },
};
