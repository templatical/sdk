import type { ParagraphBlock } from "@templatical/types";
import { fillEmptyParagraphs, isBlankRichText } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import {
  RICH_TEXT_CSS_CLASS,
  richTextGapClass,
  resolveParagraphGap,
} from "../rich-text";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a paragraph block to MJML markup.
 * All text formatting is inline in the HTML content (managed by TipTap).
 */
export function renderParagraph(
  block: ParagraphBlock,
  context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  // Skip when the user has cleared the paragraph — otherwise we emit a
  // styled `<td>` cell that adds visible whitespace to the email even
  // though the canvas shows nothing for an empty paragraph.
  if (isBlankRichText(block.content)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  // The canvas fills blank lines with the same helper, so the two agree.
  const content = fillEmptyParagraphs(convertMergeTagsToValues(block.content));
  const cssClassAttr = getCssClassAttr(block, [
    RICH_TEXT_CSS_CLASS,
    richTextGapClass(resolveParagraphGap(block.paragraphSpacing)),
  ]);

  // RTL templates need a start-edge default on the wrapper. Inner
  // `<p style="text-align:…">` from TipTap still wins per paragraph.
  const alignAttr =
    context.contentDirection === "rtl" ? '\n  align="right"' : "";

  return `<mj-text
  line-height="1.5"${alignAttr}
  padding="${padding}"${bgColor}${cssClassAttr}
>${content}</mj-text>`;
}
