import type { ParagraphBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a paragraph block to MJML markup.
 * All text formatting is inline in the HTML content (managed by TipTap).
 */
export function renderParagraph(
  block: ParagraphBlock,
  _context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` background-color="${block.styles.backgroundColor}"`
    : "";
  const content = convertMergeTagsToValues(block.content);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-text
  line-height="1.5"
  padding="${padding}"${bgColor}${visibilityAttr}
>${content}</mj-text>`;
}
