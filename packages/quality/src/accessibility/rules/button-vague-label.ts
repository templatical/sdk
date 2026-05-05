import { isButton } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getDictionary } from "../dictionaries";

export const meta: RuleMeta = {
  id: "button-vague-label",
  severity: "warning",
};

export const buttonVagueLabel: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isButton(block)) return null;
    const text = (block.text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (text === "") return null;
    const phrases = getDictionary(opts.locale).vagueButtonLabels;
    if (!phrases.includes(text)) return null;
    return { blockId: block.id, params: { text: block.text } };
  },
};
