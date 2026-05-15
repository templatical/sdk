import type { SectionBlock } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { Rule, RuleMeta, WalkContext } from "../../types";

export const meta: RuleMeta = {
  id: "structure.nested-section",
  severity: "error",
};

export const nestedSection: Rule = {
  meta,
  block(block, ctx: WalkContext) {
    if (!isSection(block)) return null;
    if (ctx.section === null) return null;
    const parentSection = ctx.section as SectionBlock;
    return {
      blockId: block.id,
      params: { parentId: parentSection.id },
    };
  },
};
