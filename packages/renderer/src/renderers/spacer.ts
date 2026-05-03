import type { SpacerBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a spacer block to MJML markup.
 *
 * The canvas renders a spacer at exactly `block.height` pixels and ignores
 * `block.styles.padding`. Match that here: emit `padding="0"` so the
 * exported email's spacer occupies the same vertical space the user saw
 * in the editor preview. Any non-zero `block.styles.padding` on a spacer
 * is meaningless and silently dropped from the export.
 */
export function renderSpacer(
  block: SpacerBlock,
  _context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const height = block.height;
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${block.styles.backgroundColor}"`
    : "";
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-spacer height="${height}px" padding="0"${bgColor}${visibilityAttr} />`;
}
