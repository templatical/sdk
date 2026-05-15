import type { Block, SectionBlock, TemplateContent } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.empty-column",
  severity: "warning",
};

function findEmptyColumns(blocks: Block[], hits: RuleHit[]): void {
  for (const block of blocks) {
    if (!isSection(block)) continue;
    const section = block as SectionBlock;
    if (section.children.length > 1) {
      section.children.forEach((column, columnIndex) => {
        if (column.length === 0) {
          hits.push({
            blockId: section.id,
            params: { columnIndex: columnIndex + 1 },
          });
        }
      });
    }
    for (const column of section.children) {
      findEmptyColumns(column, hits);
    }
  }
}

export const emptyColumn: Rule = {
  meta,
  template(content: TemplateContent): RuleHit[] {
    const hits: RuleHit[] = [];
    findEmptyColumns(content.blocks, hits);
    return hits;
  },
};
