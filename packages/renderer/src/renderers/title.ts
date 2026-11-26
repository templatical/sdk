import type { TitleBlock } from "@templatical/types";
import {
  HEADING_LEVEL_FONT_SIZE,
  TITLE_FONT_WEIGHT,
  TITLE_LINE_HEIGHT,
  fillEmptyParagraphs,
  findOpenTagEnd,
} from "@templatical/types";
import type { RenderContext } from "../render-context";
import {
  convertMergeTagsToValues,
  escapeAttr,
  escapeFontFamily,
} from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import {
  RICH_TEXT_CSS_CLASS,
  decodeStyleReferences,
  effectiveInlineFontFamily,
  resolveInlineFontFamilies,
  richTextGapClass,
  resolveParagraphGap,
} from "../rich-text";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";
import {
  addOutlookLineHeightWithFontSize,
  outlookLineHeightPx,
} from "../outlook-line-height";

/**
 * Render a title block to MJML markup.
 */
export function renderTitle(block: TitleBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  // Blank lines between a title's paragraphs are filled as the canvas fills
  // them; a single paragraph is unwrapped into the heading.
  const decoded = decodeStyleReferences(
    resolveInlineFontFamilies(
      fillEmptyParagraphs(convertMergeTagsToValues(block.content ?? "")),
      (family) => context.resolveFontFamily(family),
    ),
  );
  // Clamp out-of-range levels to a defined entry so we never interpolate
  // `undefined` into `font-size="${...}px"` (mjml@5 rejects "undefinedpx").
  const fontSize =
    HEADING_LEVEL_FONT_SIZE[block.level] ?? HEADING_LEVEL_FONT_SIZE[2];
  const richText = addOutlookLineHeightWithFontSize(decoded, {
    lineHeight: TITLE_LINE_HEIGHT,
    fontSizePx: fontSize,
  });
  const { content, fontFamily: paragraphFontFamily } = unwrapParagraph(
    richText.html,
    (family) => context.resolveFontFamily(family),
  );
  const headingFontSize =
    content === richText.html
      ? fontSize
      : (richText.firstParagraphFontSizePx ?? fontSize);
  const alt = outlookLineHeightPx(TITLE_LINE_HEIGHT, headingFontSize);
  // Emit the color only when the block sets one; otherwise the `mj-text`
  // inherits the document `textColor` default from `<mj-attributes>`.
  const colorAttr = block.color ? `\n  color="${escapeAttr(block.color)}"` : "";
  const align = escapeAttr(block.textAlign);
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  // `unwrapParagraph` strips only a *single* outer `<p>`, so a title the user
  // pressed Enter in keeps its paragraphs and needs a spacing rule. Titles
  // carry no gap of their own, so they always take the default.
  const cssClassAttr = getCssClassAttr(block, [
    RICH_TEXT_CSS_CLASS,
    richTextGapClass(resolveParagraphGap(undefined)),
  ]);
  // Same clamp logic as fontSize so that an out-of-range level still
  // produces a valid heading element.
  const safeLevel = HEADING_LEVEL_FONT_SIZE[block.level] ? block.level : 2;
  const tag = `h${safeLevel}`;
  const headingFontFamily = paragraphFontFamily
    ? `;font-family: ${escapeAttr(paragraphFontFamily)}`
    : "";

  return `<mj-text
  font-size="${fontSize}px"${colorAttr}
  align="${align}"
  line-height="${TITLE_LINE_HEIGHT}"
  padding="${padding}"${bgColor}${fontFamilyAttr}${cssClassAttr}
><${tag} style="margin:0;font-size:inherit;color:inherit;line-height:inherit;font-weight:${TITLE_FONT_WEIGHT};mso-line-height-alt:${alt}${headingFontFamily}">${content}</${tag}></mj-text>`;
}

/**
 * The editor stores title content as a TipTap paragraph (`<p>...</p>`),
 * but the renderer wraps it in `<h${level}>`. `<p>` is invalid inside a
 * heading, so strip a single outer `<p>` wrapper if present.
 */
function unwrapParagraph(
  html: string,
  resolveFontFamily: (family: string) => string,
): {
  content: string;
  fontFamily?: string;
} {
  const openingTag = /^\s*<p\b/.exec(html);
  if (!openingTag) return { content: html };
  const openingTagEnd = findOpenTagEnd(html, openingTag[0].length);
  if (openingTagEnd === -1) return { content: html };
  const closingTag = /<\/p>\s*$/.exec(html);
  if (!closingTag || closingTag.index <= openingTagEnd)
    return { content: html };
  const content = html.slice(openingTagEnd + 1, closingTag.index);
  // Only unwrap when there is exactly one top-level <p> — otherwise the
  // content has multiple paragraphs and we must leave it alone.
  if (/<\/p>\s*<p\b/i.test(content)) return { content: html };
  return {
    content,
    fontFamily: effectiveInlineFontFamily(
      html.slice(0, openingTagEnd + 1),
      resolveFontFamily,
    ),
  };
}

function renderFontFamilyAttr(
  fontFamily: string | undefined,
  context: RenderContext,
): string {
  if (!fontFamily) {
    return "";
  }

  const resolved = context.resolveFontFamily(fontFamily);

  return ` font-family="${escapeFontFamily(resolved)}"`;
}
