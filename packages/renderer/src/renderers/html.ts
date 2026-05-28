import type { HtmlBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render an HTML block to MJML markup.
 * No sanitization in the OSS version -- consumers are responsible for content safety.
 */
export function renderHtml(block: HtmlBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  if (!context.allowHtmlBlocks) {
    return "";
  }

  const content = block.content;

  if (content === "") {
    return "";
  }

  const visibilityAttr = getCssClassAttr(block);
  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");

  // Use mj-text to render HTML content inside proper table cell structure.
  // mj-raw bypasses MJML's table layout and content won't be visible.
  return `<mj-text padding="${padding}"${bgColor}${visibilityAttr}>
${content}
</mj-text>`;
}
