import type { CustomBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a custom block to MJML markup.
 *
 * Custom block HTML resolution order:
 *   1. `context.customBlockHtml` map — populated by `renderToMjml` when the
 *      caller passes a `renderCustomBlock` option (typical for editor
 *      consumers and headless callers wiring their own resolver).
 *   2. `block.renderedHtml` — populated by an external pre-render step
 *      (e.g., a previous render pass that mutated the block).
 *   3. Empty — block omitted from output.
 */
export function renderCustom(
  block: CustomBlock,
  context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const fromContext = context.customBlockHtml.get(block.id);
  const content = fromContext ?? block.renderedHtml;

  if (!content || content === "") {
    return "";
  }

  const visibilityAttr = getCssClassAttr(block);

  return `<mj-text${visibilityAttr}>
${content}
</mj-text>`;
}
