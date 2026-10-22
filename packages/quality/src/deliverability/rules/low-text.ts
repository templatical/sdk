import {
  isButton,
  isCountdown,
  isHtml,
  isImage,
  isMenu,
  isParagraph,
  isTable,
  isTitle,
  isVideo,
} from "@templatical/types";
import type { Rule, RuleHit, RuleMeta } from "../../types";
import { extractText } from "../../html-utils";
import { walkBlocks } from "../../walk";

export const meta: RuleMeta = {
  id: "deliverability.low-text",
  severity: "info",
};

export const lowText: Rule = {
  meta,
  template(content, opts): RuleHit[] {
    let hasCustom = false;
    let hasImage = false;
    const parts: string[] = [];
    walkBlocks(content, (block) => {
      if (block.type === "custom") hasCustom = true;
      if (
        (isImage(block) && block.src.trim() !== "") ||
        isVideo(block) ||
        isCountdown(block)
      )
        hasImage = true;
      if (isTitle(block) || isParagraph(block) || isHtml(block))
        parts.push(extractText(block.content));
      if (isTable(block)) {
        for (const row of block.rows)
          for (const cell of row.cells) parts.push(extractText(cell.content));
      }
      if (isButton(block)) parts.push(block.text);
      if (isMenu(block)) for (const item of block.items) parts.push(item.text);
    });
    if (hasCustom || !hasImage) return [];
    const count = parts.join(" ").replace(/\s+/g, " ").trim().length;
    const min = opts.deliverability.minTextLength;
    return count < min ? [{ blockId: null, params: { count, min } }] : [];
  },
};
