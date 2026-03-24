import type { SpacerBlock } from '@templatical/types';
import type { RenderContext } from '../render-context';
import { toPaddingString } from '../padding';
import { isHiddenOnAll, getCssClassAttr } from '../visibility';

/**
 * Render a spacer block to MJML markup.
 */
export function renderSpacer(block: SpacerBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return '';
  }

  const height = block.height;
  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${block.styles.backgroundColor}"`
    : '';
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-spacer height="${height}px" padding="${padding}"${bgColor}${visibilityAttr} />`;
}
