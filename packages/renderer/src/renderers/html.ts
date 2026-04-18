import type { HtmlBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
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

  // Use mj-text to render HTML content inside proper table cell structure.
  // mj-raw bypasses MJML's table layout and content won't be visible.
  return `<mj-text${visibilityAttr}>
${content}
</mj-text>`;
}
