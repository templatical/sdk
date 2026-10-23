import { isTitle } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { extractText } from "../../html-utils";

export const meta: RuleMeta = {
  id: "a11y.heading-empty",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#headings",
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
