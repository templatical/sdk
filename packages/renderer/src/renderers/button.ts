import type { ButtonBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr, escapeHtml } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
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
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const buttonPadding = toPaddingString(block.buttonPadding);

  // Omit href entirely when no URL is set so we don't emit a clickable
  // `<a href="">` that navigates to whatever URL the email is opened from.
  const href = block.url === "" ? "" : escapeAttr(block.url);
  const hrefAttr = href === "" ? "" : ` href="${href}"`;
  const backgroundColor = escapeAttr(block.backgroundColor);
  const textColor = escapeAttr(block.textColor);
  const fontSize = block.fontSize;
  const borderRadius = block.borderRadius;
  const text = escapeHtml(block.text);
  const targetAttr = block.openInNewTab
    ? ' target="_blank" rel="noopener"'
    : "";
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const visibilityAttr = getCssClassAttr(block);

  return `<mj-button${hrefAttr}${targetAttr}
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
