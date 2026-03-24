import type { TextBlock } from '@templatical/types';
import type { RenderContext } from '../render-context';
import { convertMergeTagsToValues } from '../escape';
import { toPaddingString } from '../padding';
import { isHiddenOnAll, getCssClassAttr } from '../visibility';

/**
 * Render a text block to MJML markup.
 */
export function renderText(block: TextBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return '';
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` background-color="${block.styles.backgroundColor}"`
    : '';
  const content = convertMergeTagsToValues(block.content);
  const fontSize = block.fontSize;
  const color = block.color;
  const align = block.textAlign;
  const fontWeight = block.fontWeight;
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-text
  font-size="${fontSize}px"
  color="${color}"
  align="${align}"
  font-weight="${fontWeight}"
  line-height="1.5"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
>${content}</mj-text>`;
}

function renderFontFamilyAttr(
  fontFamily: string | undefined,
  context: RenderContext,
): string {
  if (!fontFamily) {
    return '';
  }

  const resolved = context.resolveFontFamily(fontFamily);

  return ` font-family="${resolved}"`;
}
