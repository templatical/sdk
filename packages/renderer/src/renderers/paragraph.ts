import type { ParagraphBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
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

  // Skip when the user has cleared the paragraph — otherwise we emit a
  // styled `<td>` cell that adds visible whitespace to the email even
  // though the canvas shows nothing for an empty paragraph.
  //
  // Use `[^<>]*` (not `[^>]*`) inside the tag to keep the regex linear:
  // `[^>]*` lets the engine consume across nested `<` chars and then
  // backtrack one char at a time when no closing `>` exists, which is
  // O(n²) over inputs like `<p<p<p<p…`. `[^<>]*` fails fast at the
  // next `<` and keeps each match attempt O(1). Real HTML attributes
  // never contain a raw `<`, so the restriction is semantics-preserving.
  const stripped = block.content.replace(/<\/?p\b[^<>]*>/gi, "").trim();
  if (stripped === "") {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const content = convertMergeTagsToValues(block.content);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-text
  line-height="1.5"
  padding="${padding}"${bgColor}${visibilityAttr}
>${content}</mj-text>`;
}
