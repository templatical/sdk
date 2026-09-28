import type { DividerBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a divider block to MJML markup.
 */
export function renderDivider(
  block: DividerBlock,
  _context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${escapeAttr(block.styles.backgroundColor)}"`
    : "";
  // A percentage passes through as is: MJML takes it natively.
  const width =
    block.width === "full"
      ? "100%"
      : typeof block.width === "number"
        ? `${block.width}px`
        : block.width;
  const thickness = block.thickness;
  const lineStyle = block.lineStyle;
  const color = escapeAttr(block.color);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-divider
  border-width="${thickness}px"
  border-style="${lineStyle}"
  border-color="${color}"
  width="${width}"
  padding="${padding}"${bgColor}${visibilityAttr}
/>`;
}
