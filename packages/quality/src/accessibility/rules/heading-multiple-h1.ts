import { isTitle, isSection } from "@templatical/types";
import type { Block, TitleBlock, TemplateContent } from "@templatical/types";
import type { Rule, RuleMeta } from "../../types";

export const meta: RuleMeta = {
  id: "heading-multiple-h1",
  severity: "warning",
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

export const headingMultipleH1: Rule = {
  meta,
  template(content: TemplateContent) {
    const titles: TitleBlock[] = [];
    collectTitles(content.blocks, titles);
    const h1s = titles.filter((t) => t.level === 1);
    if (h1s.length <= 1) return [];
    return h1s.slice(1).map((title) => ({ blockId: title.id }));
  },
};
