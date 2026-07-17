import type { MenuBlock, MenuItemData } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeHtml, escapeAttr, escapeCssValue } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Render a menu block to MJML markup.
 * Uses mj-text with inline <a> tags separated by styled <span> separators.
 */
export function renderMenu(block: MenuBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  if (block.items.length === 0) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const visibilityAttr = getCssClassAttr(block);
  const fontFamilyAttr = renderFontFamilyAttr(block.fontFamily, context);
  const align = block.textAlign;
  const fontSize = block.fontSize;
  // Emit the color only when set; otherwise the `mj-text` inherits the
  // document `textColor` and the item anchors below inherit it in turn.
  const colorAttr = block.color ? `\n  color="${escapeAttr(block.color)}"` : "";

  const content = renderMenuItems(block);

  return `<mj-text
  font-size="${fontSize}px"${colorAttr}
  align="${align}"
  line-height="1.5"
  padding="${padding}"${bgColor}${fontFamilyAttr}${visibilityAttr}
>${content}</mj-text>`;
}

function renderMenuItems(block: MenuBlock): string {
  const items = block.items;
  const separator = escapeHtml(block.separator);
  const separatorColor = escapeCssValue(block.separatorColor);
  const spacing = block.spacing;
  const linkColor = block.linkColor ?? block.color;

  const parts: string[] = [];
  const itemCount = items.length;

  for (let index = 0; index < itemCount; index++) {
    parts.push(renderMenuItem(items[index], linkColor));

    if (index < itemCount - 1) {
      parts.push(
        `<span style="color: ${separatorColor}; padding: 0 ${spacing}px;">${separator}</span>`,
      );
    }
  }

  return parts.join("");
}

function renderMenuItem(
  item: MenuItemData,
  linkColor: string | undefined,
): string {
  const text = escapeHtml(item.text);
  const url = escapeAttr(item.url);
  // Item color, else the menu link color; when neither is set the anchor omits
  // an explicit color and inherits the mj-text color (the document `textColor`).
  const resolvedColor = item.color ?? linkColor;
  const target = item.openInNewTab ? ' target="_blank" rel="noopener"' : "";

  const styles: string[] = ["text-decoration: none"];

  if (resolvedColor) {
    styles.unshift(`color: ${escapeCssValue(resolvedColor)}`);
  }

  if (item.bold) {
    styles.push("font-weight: bold");
  }

  if (item.underline) {
    styles.push("text-decoration: underline");
  }

  const styleAttr = styles.join("; ");

  return `<a href="${url}" style="${styleAttr}"${target}>${text}</a>`;
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
