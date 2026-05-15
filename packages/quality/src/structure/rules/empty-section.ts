import type { SectionBlock } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.empty-section",
  severity: "warning",
};

function isSectionEmpty(section: SectionBlock): boolean {
  if (section.children.length === 0) return true;
  return section.children.every((column) => column.length === 0);
}

export const emptySection: Rule = {
  meta,
  block(block) {
    if (!isSection(block)) return null;
    const section = block as SectionBlock;
    if (!isSectionEmpty(section)) return null;
    return {
      blockId: section.id,
      fix: {
        description: "Remove the empty section",
        apply: (ctx) => {
          ctx.removeBlock(section.id);
        },
      },
    };
  },
};
