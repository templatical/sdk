import { isSection, resolveBackgroundImage } from "@templatical/types";
import type { Rule, RuleMeta, WalkContext } from "../../types";
import { enclosingBand } from "../band";

export const meta: RuleMeta = {
  id: "structure.nested-background-image",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#email-client-compatibility",
  severity: "warning",
};

/**
 * A background image on both a wrapper and its section nests two VML fills,
 * which Outlook desktop doesn't support (MJML's `mj-wrapper` README).
 */
export const nestedBackgroundImage: Rule = {
  meta,
  block(block, ctx: WalkContext) {
    if (!isSection(block)) return null;
    if (resolveBackgroundImage(block.backgroundImage) === null) return null;
    const band = enclosingBand(block, ctx);
    if (band === null) return null;
    if (resolveBackgroundImage(band.backgroundImage) === null) return null;
    return { blockId: block.id };
  },
};
