import { isMenu, isTable } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "text-too-small",
  severity: "warning",
};

function getFontSize(block: Block): number | null {
  if (isMenu(block) || isTable(block)) return block.fontSize;
  return null;
}

export const textTooSmall: Rule = {
  meta,
  block(block, _ctx, opts) {
    const fontSize = getFontSize(block);
    if (fontSize === null) return null;
    if (fontSize >= opts.thresholds.minFontSize) return null;
    return {
      blockId: block.id,
      params: { size: fontSize, min: opts.thresholds.minFontSize },
    };
  },
};
