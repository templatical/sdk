import type { SectionBlock } from "@templatical/types";
import { getColumnCount, isSection } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.section-column-mismatch",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#section-layout",
  severity: "error",
};

export const sectionColumnMismatch: Rule = {
  meta,
  block(block) {
    if (!isSection(block)) return null;
    const section = block as SectionBlock;
    const expected = getColumnCount(section.columns);
    const actual = section.children.length;
    if (actual === expected) return null;
    return {
      blockId: section.id,
      params: { layout: section.columns, expected, actual },
    };
  },
};
