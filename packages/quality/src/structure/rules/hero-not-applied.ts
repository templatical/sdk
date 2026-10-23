import { isSection, resolveHero } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.hero-not-applied",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#content-presence",
  severity: "warning",
  messageVariants: ["columns", "image", "size"],
};

/**
 * A section with `hero` set that renders as a regular section, and why: more
 * than one column, no background image, or `height: "image"` without the
 * image's size. Covers the editor's in-between states (a Hero shortcut before
 * its image is set, a hero switched to two columns) as well as JSON- and
 * agent-authored content and imported heroes that came without a size.
 */
export const heroNotApplied: Rule = {
  meta,
  block(block) {
    if (!isSection(block)) return null;
    const hero = resolveHero(block);
    if (hero === null || hero.applied) return null;
    return { blockId: block.id, messageVariant: hero.reason };
  },
};
