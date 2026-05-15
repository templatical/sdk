import type { Block, SectionBlock, TemplateContent } from "@templatical/types";
import { isSection } from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "structure.duplicate-block-id",
  severity: "error",
};

function collectIds(blocks: Block[], counts: Map<string, number>): void {
  for (const block of blocks) {
    counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
    if (isSection(block)) {
      for (const column of (block as SectionBlock).children) {
        collectIds(column, counts);
      }
    }
  }
}

export const duplicateBlockId: Rule = {
  meta,
  template(content: TemplateContent): RuleHit[] {
    const counts = new Map<string, number>();
    collectIds(content.blocks, counts);

    const hits: RuleHit[] = [];
    for (const [id, count] of counts) {
      if (count > 1) {
        hits.push({ blockId: id, params: { count } });
      }
    }
    return hits;
  },
};
