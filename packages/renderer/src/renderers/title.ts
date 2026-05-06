import type { TitleBlock } from "@templatical/types";
import { HEADING_LEVEL_FONT_SIZE } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { convertMergeTagsToValues, escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a title block to MJML markup.
 */
export function renderTitle(block: TitleBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const content = unwrapParagraph(convertMergeTagsToValues(block.content));
  // Clamp out-of-range levels to a defined entry so we never interpolate
  // `undefined` into `font-size="${...}px"` (mjml@5 rejects "undefinedpx").
  const fontSize =
    HEADING_LEVEL_FONT_SIZE[block.level] ?? HEADING_LEVEL_FONT_SIZE[2];
  const color = escapeAttr(block.color);
  const align = block.textAlign;
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const visibilityAttr = getCssClassAttr(block);
  // Same clamp logic as fontSize so that an out-of-range level still
  // produces a valid heading element.
  const safeLevel = HEADING_LEVEL_FONT_SIZE[block.level] ? block.level : 2;
  const tag = `h${safeLevel}`;

  return `<mj-text
  font-size="${fontSize}px"
  color="${color}"
  align="${align}"
  line-height="1.3"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
><${tag} style="margin:0;font-size:inherit;color:inherit;line-height:inherit">${content}</${tag}></mj-text>`;
}

/**
 * The editor stores title content as a TipTap paragraph (`<p>...</p>`),
 * but the renderer wraps it in `<h${level}>`. `<p>` is invalid inside a
 * heading, so strip a single outer `<p>` wrapper if present.
 */
function unwrapParagraph(html: string): string {
  const match = html.match(/^\s*<p\b[^>]*>([\s\S]*)<\/p>\s*$/);
  if (!match) return html;
  // Only unwrap when there is exactly one top-level <p> — otherwise the
  // content has multiple paragraphs and we must leave it alone.
  if (/<\/p>\s*<p\b/i.test(match[1])) return html;
  return match[1];
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
