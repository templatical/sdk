import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "a11y.img-decorative-needs-empty-alt",
  reference:
    "https://docs.templatical.com/quality/accessibility/rule-catalog#images",
  severity: "info",
};

export const imgDecorativeNeedsEmptyAlt: Rule = {
  meta,
  block(block) {
    if (!isImage(block)) return null;
    if (block.decorative !== true) return null;
    if ((block.alt ?? "").trim() === "") return null;
    return {
      blockId: block.id,
      fix: {
        description: "Clear alt text",
        apply: (ctx) => ctx.updateBlock(block.id, { alt: "" }),
      },
    };
  },
};
