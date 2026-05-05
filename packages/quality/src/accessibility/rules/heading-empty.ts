import { isTitle } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractText } from "../../html-utils";

export const meta: RuleMeta = {
  id: "heading-empty",
  severity: "error",
};

export const headingEmpty: Rule = {
  meta,
  block(block) {
    if (!isTitle(block)) return null;
    const text = extractText(block.content ?? "");
    if (text !== "") return null;
    return { blockId: block.id };
  },
};
