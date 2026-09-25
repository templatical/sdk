import type { ButtonBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr, escapeHtml } from "../escape";
import { toPaddingString } from "../padding";
import type { BorderRadiusValue } from "@templatical/types";
import { toBorderRadiusCss } from "@templatical/types";
import { bgAttr, borderAttr } from "../utils";
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
  const backgroundColor = buttonBackgroundAttr(block.backgroundColor);
  const textColor = escapeAttr(block.textColor);
  const fontSize = block.fontSize;
  const borderRadius = renderButtonRadius(block.borderRadius);
  const text = escapeHtml(block.text);
  const targetAttr = block.openInNewTab
    ? ' target="_blank" rel="noopener"'
    : "";
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const widthAttr = renderWidthAttr(block.width);
  const visibilityAttr = getCssClassAttr(block);
  const borderAttrStr = borderAttr(block.border);
  // Templates stored before `align` existed have no value for it. Fall back to
  // MJML's own default so they keep rendering exactly as they did.
  const align = block.align ?? "center";

  return `<mj-button${hrefAttr}${targetAttr}
  background-color="${backgroundColor}"
  color="${textColor}"
  font-size="${fontSize}px"
  font-weight="bold"
  border-radius="${borderRadius}"${borderAttrStr}
  inner-padding="${buttonPadding}"
  align="${align}"
  padding="${padding}"${bgColor}${fontFamilyAttr}${widthAttr}${visibilityAttr}
>${text}</mj-button>`;
}

/**
 * MJML paints `#414141` when `background-color` is omitted, and `""` is not a
 * color it accepts. An unset button fill is the keyword `transparent`.
 */
function buttonBackgroundAttr(color: string): string {
  if (color.trim() === "") return "transparent";
  return escapeAttr(color);
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

/**
 * The button has always emitted its radius, `0px` included, so a plain number
 * keeps rendering exactly as it did. Per-corner radii go through the shared
 * formatter, with all-square corners as `0px`.
 */
function renderButtonRadius(radius: BorderRadiusValue): string {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  return toBorderRadiusCss(radius) ?? "0px";
}

function renderWidthAttr(width: number | "full" | undefined): string {
  if (width === undefined) {
    return "";
  }

  const value = width === "full" ? "100%" : `${width}px`;

  return ` width="${value}"`;
}
