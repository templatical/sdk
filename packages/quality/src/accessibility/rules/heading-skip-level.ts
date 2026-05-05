import { isTitle, isSection } from "@templatical/types";
import type { Block, TitleBlock, TemplateContent } from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "heading-skip-level",
  severity: "error",
};

function collectTitles(blocks: Block[], out: TitleBlock[]): void {
  for (const block of blocks) {
    if (isTitle(block)) {
      out.push(block);
      continue;
    }
    if (isSection(block)) {
      for (const column of block.children) {
        collectTitles(column, out);
      }
    }
  }
}

export const headingSkipLevel: Rule = {
  meta,
  template(content: TemplateContent) {
    const titles: TitleBlock[] = [];
    collectTitles(content.blocks, titles);

    const hits: RuleHit[] = [];
    let lastLevel = 0;

    for (const title of titles) {
      if (lastLevel !== 0 && title.level > lastLevel + 1) {
        hits.push({
          blockId: title.id,
          params: { from: lastLevel, to: title.level },
        });
      }
      lastLevel = title.level;
    }

    return hits;
  },
};
