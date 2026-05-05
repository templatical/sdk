import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "img-decorative-needs-empty-alt",
  severity: "info",
};

export const imgDecorativeNeedsEmptyAlt: Rule = {
  meta,
  block(block) {
    if (!isImage(block)) return null;
    if (block.decorative !== true) return null;
    if ((block.alt ?? "") === "") return null;
    return {
      blockId: block.id,
      fix: {
        description: "Clear alt text",
        apply: (ctx) => ctx.updateBlock(block.id, { alt: "" }),
      },
    };
  },
};
