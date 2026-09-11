import { isParagraph, isTitle } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractText } from "../../html-utils";

export const meta: RuleMeta = {
  id: "a11y.text-all-caps",
  severity: "warning",
};

export const textAllCaps: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isParagraph(block) && !isTitle(block)) return null;
    const text = extractText(block.content ?? "");
    const letters = text.replace(/[^\p{L}]/gu, "");
    if (letters.length < opts.thresholds.allCapsMinLength) return null;
    // Caseless scripts (Arabic, Hebrew, …) satisfy `s === s.toLocaleUpperCase()`
    // because toUpperCase is a no-op. Only shout when some letter actually
    // has a case distinction.
    const hasCasedLetter = [...letters].some(
      (ch) => ch.toLocaleLowerCase() !== ch.toLocaleUpperCase(),
    );
    if (!hasCasedLetter) return null;
    if (letters !== letters.toLocaleUpperCase()) return null;
    return { blockId: block.id };
  },
};
