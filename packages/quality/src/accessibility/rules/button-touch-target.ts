import { isButton } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "button-touch-target",
  severity: "warning",
};

export const buttonTouchTarget: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isButton(block)) return null;
    const padding = block.buttonPadding;
    if (!padding) return null;
    const estimatedHeight = block.fontSize * 1.4 + padding.top + padding.bottom;
    if (estimatedHeight >= opts.thresholds.minTouchTargetPx) return null;
    return {
      blockId: block.id,
      params: {
        height: Math.round(estimatedHeight),
        min: opts.thresholds.minTouchTargetPx,
      },
    };
  },
};
