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
    // WCAG large text = 18pt (~24px). Headings have no structured bold
    // flag in this codebase (TipTap stores it inline), so we conservatively
    // skip the 14pt-bold (~18.66px) relaxation and apply the px threshold.
    const required = fontSize >= 24 ? 3 : 4.5;
    const ratio = getContrastRatio(block.color, ctx.resolvedBackgroundColor);
    if (Number.isNaN(ratio) || ratio >= required) return null;
    return {
      blockId: block.id,
      params: { ratio: ratio.toFixed(2), required },
    };
  },
};
