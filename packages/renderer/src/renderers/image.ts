import type { ImageBlock } from '@templatical/types';
import type { RenderContext } from '../render-context';
import { escapeAttr } from '../escape';
import { toPaddingString } from '../padding';
import { isHiddenOnAll, getCssClassAttr } from '../visibility';

/**
 * Render an image block to MJML markup.
 */
export function renderImage(block: ImageBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return '';
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` background-color="${block.styles.backgroundColor}"`
    : '';
  const width =
    block.width === 'full'
      ? context.containerWidth + 'px'
      : block.width + 'px';

  const visibilityAttr = getCssClassAttr(block);

  let linkAttr = '';
  if (block.linkUrl) {
    linkAttr = ` href="${escapeAttr(block.linkUrl)}"`;
    if (block.linkOpenInNewTab) {
      linkAttr += ' target="_blank"';
    }
  }

  const src = escapeAttr(block.src);
  const alt = escapeAttr(block.alt);
  const align = block.align;

  return `<mj-image
  src="${src}"
  alt="${alt}"
  width="${width}"
  align="${align}"
  padding="${padding}"${bgColor}${linkAttr}${visibilityAttr}
/>`;
}
