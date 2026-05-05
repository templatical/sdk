import { isImage } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "img-alt-too-long",
  severity: "warning",
};

export const imgAltTooLong: Rule = {
  meta,
  block(block, _ctx, opts) {
    if (!isImage(block) || block.decorative === true) return null;
    const alt = block.alt ?? "";
    if (alt.length <= opts.thresholds.altMaxLength) return null;
    return {
      blockId: block.id,
      params: { length: alt.length, max: opts.thresholds.altMaxLength },
    };
  },
};
