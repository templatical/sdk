import { isParagraph, isTitle } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { hasNestedAnchors } from "../../html-utils";

export const meta: RuleMeta = {
  id: "a11y.link-nested-anchor",
  severity: "error",
};

function getHtml(block: Block): string | null {
  if (isParagraph(block) || isTitle(block)) return block.content;
  return null;
}

export const linkNestedAnchor: Rule = {
  meta,
  block(block) {
    const html = getHtml(block);
    if (html === null) return null;
    if (!hasNestedAnchors(html)) return null;
    return { blockId: block.id };
  },
};
