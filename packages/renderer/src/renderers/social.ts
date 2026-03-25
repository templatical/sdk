import type { SocialIconsBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";
import { generateSocialIconDataUri } from "../social-icons";

/**
 * Render a social icons block to MJML markup.
 */
export function renderSocialIcons(
  block: SocialIconsBlock,
  context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const icons = block.icons;

  if (icons.length === 0) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${block.styles.backgroundColor}"`
    : "";
  const visibilityAttr = getCssClassAttr(block);
  const align = block.align;
  const iconSize = block.iconSize;
  const iconStyle = block.iconStyle;
  const spacing = block.spacing;

  let iconSizePx: number;
  switch (iconSize) {
    case "small":
      iconSizePx = 24;
      break;
    case "large":
      iconSizePx = 48;
      break;
    default:
      iconSizePx = 32;
      break;
  }

  // MJML mj-social-element has default border-radius of 3px, override per style
  let borderRadius: string;
  switch (iconStyle) {
    case "circle":
      borderRadius = "50%";
      break;
    case "rounded":
      borderRadius = "8px";
      break;
    case "square":
      borderRadius = "0";
      break;
    default:
      borderRadius = "4px"; // solid, outlined
      break;
  }

  const iconCount = icons.length;
  const socialElements = icons.map((icon, index) => {
    const platform = icon.platform;
    const url = escapeAttr(icon.url);

    // Generate custom SVG icon as data URI to match editor appearance
    const iconSrc = generateSocialIconDataUri(platform, iconStyle, iconSizePx);

    // Apply spacing as right padding only (except last icon) to match CSS gap behavior
    const rightPad = index === iconCount - 1 ? 0 : spacing;

    // Empty content hides the platform name text, matching the editor display
    return `<mj-social-element src="${iconSrc}" href="${url}" icon-size="${iconSizePx}px" padding="0 ${rightPad}px 0 0" border-radius="${borderRadius}" background-color="transparent"></mj-social-element>`;
  });

  const socialContent = socialElements.join("\n");

  return `<mj-social
  mode="horizontal"
  align="${align}"
  icon-padding="0"
  padding="${padding}"${bgColor}${visibilityAttr}
>
${socialContent}
</mj-social>`;
}
