import type { ButtonBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr, escapeHtml } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a button block to MJML markup.
 */
export function renderButton(
  block: ButtonBlock,
  context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${block.styles.backgroundColor}"`
    : "";
  const buttonPadding = toPaddingString(block.buttonPadding);

  const href = escapeAttr(block.url);
  const backgroundColor = block.backgroundColor;
  const textColor = block.textColor;
  const fontSize = block.fontSize;
  const borderRadius = block.borderRadius;
  const text = escapeHtml(block.text);
  const targetAttr = block.openInNewTab ? ' target="_blank"' : "";
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-button
  href="${href}"${targetAttr}
  background-color="${backgroundColor}"
  color="${textColor}"
  font-size="${fontSize}px"
  font-weight="bold"
  border-radius="${borderRadius}px"
  inner-padding="${buttonPadding}"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
>${text}</mj-button>`;
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
