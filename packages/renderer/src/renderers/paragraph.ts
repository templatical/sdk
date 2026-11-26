import type { ParagraphBlock } from "@templatical/types";
import {
  PARAGRAPH_LINE_HEIGHT,
  fillEmptyParagraphs,
  isBlankRichText,
} from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import {
  RICH_TEXT_CSS_CLASS,
  decodeStyleReferences,
  resolveInlineFontFamilies,
  richTextGapClass,
  resolveParagraphGap,
} from "../rich-text";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";
import {
  addOutlookLineHeight,
  DEFAULT_TEXT_FONT_SIZE,
} from "../outlook-line-height";

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
  const html = block.content ?? "";

  if (isBlankRichText(html)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  // The canvas fills blank lines with the same helper, so the two agree.
  const content = addOutlookLineHeight(
    decodeStyleReferences(
      resolveInlineFontFamilies(
        fillEmptyParagraphs(convertMergeTagsToValues(html)),
        (family) => context.resolveFontFamily(family),
      ),
    ),
    { lineHeight: PARAGRAPH_LINE_HEIGHT, fontSizePx: DEFAULT_TEXT_FONT_SIZE },
  );
  const cssClassAttr = getCssClassAttr(block, [
    RICH_TEXT_CSS_CLASS,
    richTextGapClass(resolveParagraphGap(block.paragraphSpacing)),
  ]);

  // RTL templates need a start-edge default on the wrapper. Inner
  // `<p style="text-align:…">` from TipTap still wins per paragraph.
  const alignAttr =
    context.contentDirection === "rtl" ? '\n  align="right"' : "";

  return `<mj-text
  line-height="${PARAGRAPH_LINE_HEIGHT}"${alignAttr}
  padding="${padding}"${bgColor}${cssClassAttr}
>${content}</mj-text>`;
}
