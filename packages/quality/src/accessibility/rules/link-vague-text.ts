import { isParagraph, isTitle } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractAnchors } from "../../html-utils";
import { getDictionary, normalizeForMatch } from "../dictionaries";

export const meta: RuleMeta = {
  id: "link-vague-text",
  severity: "warning",
};

function getHtml(block: Block): string | null {
  if (isParagraph(block) || isTitle(block)) return block.content;
  return null;
}

export const linkVagueText: Rule = {
  meta,
  block(block, _ctx, opts) {
    const html = getHtml(block);
    if (html === null) return null;

    const phrases = getDictionary(opts.locale).vagueLinkText;
    const anchors = extractAnchors(html);
    const offender = anchors.find((a) => {
      const text = normalizeForMatch(a.text);
      return text !== "" && phrases.includes(text);
    });
    if (!offender) return null;

    return { blockId: block.id, params: { text: offender.text } };
  },
};
