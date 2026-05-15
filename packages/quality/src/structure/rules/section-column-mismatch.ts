import type { ColumnLayout, SectionBlock } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.section-column-mismatch",
  severity: "error",
};

function expectedColumnCount(layout: ColumnLayout): number {
  if (layout === "1") return 1;
  if (layout === "3") return 3;
  return 2;
}

export const sectionColumnMismatch: Rule = {
  meta,
  block(block) {
    if (!isSection(block)) return null;
    const section = block as SectionBlock;
    const expected = expectedColumnCount(section.columns);
    const actual = section.children.length;
    if (actual === expected) return null;
    return {
      blockId: section.id,
      params: { layout: section.columns, expected, actual },
    };
  },
};
