import { isButton } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";
import { getContrastRatio } from "../../contrast";

export const meta: RuleMeta = {
  id: "button-low-contrast",
  severity: "error",
};

const MIN_RATIO = 4.5;

export const buttonLowContrast: Rule = {
  meta,
  block(block) {
    if (!isButton(block)) return null;
    const ratio = getContrastRatio(block.textColor, block.backgroundColor);
    if (Number.isNaN(ratio) || ratio >= MIN_RATIO) return null;
    return {
      blockId: block.id,
      params: { ratio: ratio.toFixed(2), required: MIN_RATIO },
    };
  },
};
