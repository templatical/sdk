import type { CustomBlock } from '@templatical/types';
import type { RenderContext } from '../render-context';
import { isHiddenOnAll, getCssClassAttr } from '../visibility';

/**
 * Render a custom block to MJML markup using pre-rendered HTML from the SDK.
 */
export function renderCustom(block: CustomBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return '';
  }

  const content = block.renderedHtml;

  if (!content || content === '') {
    return '';
  }

  const visibilityAttr = getCssClassAttr(block);

  return `<mj-text${visibilityAttr}>
${content}
</mj-text>`;
}
