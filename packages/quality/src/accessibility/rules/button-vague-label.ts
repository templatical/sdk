import { isButton } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getDictionary, normalizeForMatch } from "../dictionaries";

export const meta: RuleMeta = {
  id: "a11y.button-vague-label",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#buttons",
  severity: "warning",
};

export const buttonVagueLabel: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isButton(block)) return null;
    const text = normalizeForMatch(block.text ?? "");
    if (text === "") return null;
    const phrases = getDictionary(opts.locale).vagueButtonLabels;
    if (!phrases.includes(text)) return null;
    return { blockId: block.id, params: { text: block.text } };
  },
};
