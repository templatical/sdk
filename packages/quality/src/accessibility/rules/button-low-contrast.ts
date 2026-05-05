import { isButton } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getContrastRatio } from "../../contrast";

export const meta: RuleMeta = {
  id: "button-low-contrast",
  severity: "error",
};

export const buttonLowContrast: Rule = {
  meta,
  block(block) {
    if (!isButton(block)) return null;
    const ratio = getContrastRatio(block.textColor, block.backgroundColor);
    if (Number.isNaN(ratio)) return null;
    // WCAG large text = 18pt (~24px). Mirrors the heading rule's threshold.
    const required = block.fontSize >= 24 ? 3 : 4.5;
    if (ratio >= required) return null;
    return {
      blockId: block.id,
      params: { ratio: ratio.toFixed(2), required },
    };
  },
};
