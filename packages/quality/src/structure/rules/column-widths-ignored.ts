import { columnWidthsIssue, isSection } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.column-widths-ignored",
  reference:
    "https://docs.templatical.com/quality/structure/rule-catalog#section-layout",
  severity: "warning",
  messageVariants: ["count", "value"],
};

/**
 * A section whose `columnWidths` does not override the preset: the list
 * length differs from the layout's column count, or a value is not a finite
 * number above 0. The renderer keeps the preset's split.
 */
export const columnWidthsIgnored: Rule = {
  meta,
  block(block) {
    if (!isSection(block)) return null;
    const reason = columnWidthsIssue(block);
    if (reason === null) return null;
    return { blockId: block.id, messageVariant: reason };
  },
};
