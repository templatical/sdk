import { isParagraph, isTitle } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractAnchors } from "../../html-utils";

export const meta: RuleMeta = {
  id: "link-empty",
  severity: "error",
};

function getHtml(block: Block): string | null {
  if (isParagraph(block) || isTitle(block)) return block.content;
  return null;
}

export const linkEmpty: Rule = {
  meta,
  block(block) {
    const html = getHtml(block);
    if (html === null) return null;

    const anchors = extractAnchors(html);
    const offender = anchors.find(
      (anchor) => anchor.text === "" && !anchor.hasImageWithAlt,
    );
    if (!offender) return null;

    return { blockId: block.id };
  },
};
