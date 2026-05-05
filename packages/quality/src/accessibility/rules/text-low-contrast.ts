import { isTitle } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getContrastRatio, isOpaqueHex } from "../../contrast";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";

export const meta: RuleMeta = {
  id: "text-low-contrast",
  severity: "error",
};

export const textLowContrast: Rule = {
  meta,
  block(block, ctx) {
    if (!isTitle(block)) return null;
    if (
      !isOpaqueHex(block.color) ||
      !isOpaqueHex(ctx.resolvedBackgroundColor)
    ) {
      return null;
    }
    const fontSize = HEADING_LEVEL_FONT_SIZE[block.level];
    const required = fontSize >= 18 ? 3 : 4.5;
    const ratio = getContrastRatio(block.color, ctx.resolvedBackgroundColor);
    if (Number.isNaN(ratio) || ratio >= required) return null;
    return {
      blockId: block.id,
      params: { ratio: ratio.toFixed(2), required },
    };
  },
};
