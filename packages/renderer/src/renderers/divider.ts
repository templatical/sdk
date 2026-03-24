import type { DividerBlock } from '@templatical/types';
import type { RenderContext } from '../render-context';
import { toPaddingString } from '../padding';
import { isHiddenOnAll, getCssClassAttr } from '../visibility';

/**
 * Render a divider block to MJML markup.
 */
export function renderDivider(block: DividerBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return '';
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${block.styles.backgroundColor}"`
    : '';
  const width = block.width === 'full' ? '100%' : block.width + 'px';
  const thickness = block.thickness;
  const lineStyle = block.lineStyle;
  const color = block.color;
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-divider
  border-width="${thickness}px"
  border-style="${lineStyle}"
  border-color="${color}"
  width="${width}"
  padding="${padding}"${bgColor}${visibilityAttr}
/>`;
}
