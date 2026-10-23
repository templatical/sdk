import { isSection, resolveBackgroundImage } from "@templatical/types";
import type { Rule, RuleMeta, WalkContext } from "../../types";
import { enclosingBand, isPaintedColor } from "../band";

export const meta: RuleMeta = {
  id: "structure.wrapper-color-over-background-image",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#email-client-compatibility",
  severity: "warning",
};

/**
 * Outlook desktop paints a wrapper's background color over its section's
 * VML background image (documented in MJML's `mj-wrapper` README). Every
 * other client layers them correctly, so this warns rather than errors.
 */
export const wrapperColorOverBackgroundImage: Rule = {
  meta,
  block(block, ctx: WalkContext) {
    if (!isSection(block)) return null;
    if (resolveBackgroundImage(block.backgroundImage) === null) return null;
    const band = enclosingBand(block, ctx);
    if (band === null || !isPaintedColor(band.backgroundColor)) return null;
    return { blockId: block.id };
  },
};
