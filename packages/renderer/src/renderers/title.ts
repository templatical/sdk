import type { TitleBlock } from "@templatical/types";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a title block to MJML markup.
 */
export function renderTitle(block: TitleBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` background-color="${block.styles.backgroundColor}"`
    : "";
  const content = convertMergeTagsToValues(block.content);
  const fontSize = HEADING_LEVEL_FONT_SIZE[block.level];
  const color = block.color;
  const align = block.textAlign;
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const visibilityAttr = getCssClassAttr(block);
  const tag = `h${block.level}`;

  return `<mj-text
  font-size="${fontSize}px"
  color="${color}"
  align="${align}"
  line-height="1.3"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
><${tag} style="margin:0;font-size:inherit;color:inherit;line-height:inherit">${content}</${tag}></mj-text>`;
}

function renderFontFamilyAttr(
  fontFamily: string | undefined,
  context: RenderContext,
): string {
  if (!fontFamily) {
    return "";
  }

  const resolved = context.resolveFontFamily(fontFamily);

  return ` font-family="${resolved}"`;
}
