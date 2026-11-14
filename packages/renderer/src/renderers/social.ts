import type { SocialIconsBlock } from "@templatical/types";
import { socialIconAssetDir } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/** A custom image URL the renderer can put in `src`. Untrusted JSON may not be a string. */
function emittedImageUrl(
  icon: SocialIconsBlock["icons"][number],
): string | undefined {
  if (icon.platform !== "custom") return undefined;
  const imageUrl = icon.imageUrl as unknown;
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") return undefined;
  return imageUrl;
}

function altText(icon: SocialIconsBlock["icons"][number]): string {
  const alt = icon.platform === "custom" ? (icon.alt as unknown) : undefined;
  return typeof alt === "string" ? alt : "";
}

/**
 * Render a social icons block to MJML markup.
 *
 * Built-in icons are emitted as `<img src="…/{dir}/{platform}.png">` rather
 * than inline SVG or base64 data URIs. Outlook desktop (Word rendering
 * engine) does not support SVG and rejects base64 in `<img src>`, so hosted
 * PNGs are the only format that renders across every mainstream client. The
 * base URL is read from `context.socialIconsBaseUrl` (configurable via
 * `RenderOptions.socialIconsBaseUrl`; default is the version-pinned jsDelivr
 * mirror of this package). `{dir}` is the style, plus `-{tone}` for a
 * one-color tone (`socialIconAssetDir`).
 *
 * A custom icon sits in the same row, in source order, with `src` set to its
 * `imageUrl` and `alt` set to its text (empty when absent). It is drawn at
 * the block's icon size with `border-radius="0"` and a transparent
 * background, and it carries no `name`, so `iconStyle` and `iconTone` do not
 * apply. A custom icon is emitted only when `imageUrl` is a string and
 * non-blank after trim; anything else is omitted. A non-string `alt` is
 * emitted as empty. Right padding falls on every emitted icon except the
 * last. A block with nothing left to emit renders nothing.
 */
export function renderSocialIcons(
  block: SocialIconsBlock,
  context: RenderContext,
): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  // A custom icon without a string image URL would compile to a broken <img>,
  // same as an image block with an empty src. Spacing uses what is emitted.
  const icons = block.icons.filter(
    (icon) => icon.platform !== "custom" || emittedImageUrl(icon) !== undefined,
  );

  if (icons.length === 0) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = block.styles.backgroundColor
    ? ` container-background-color="${escapeAttr(block.styles.backgroundColor)}"`
    : "";
  const visibilityAttr = getCssClassAttr(block);
  const align = escapeAttr(block.align);
  const iconSize = block.iconSize;
  const iconStyle = block.iconStyle;
  const assetDir = escapeAttr(socialIconAssetDir(iconStyle, block.iconTone));
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
      borderRadius = "4px"; // solid, outlined, plain
      break;
  }

  const iconCount = icons.length;
  const socialElements = icons.map((icon, index) => {
    const url = escapeAttr(icon.url);

    // Apply spacing as right padding only (except last icon) to match CSS gap behavior
    const rightPad = index === iconCount - 1 ? 0 : spacing;
    const padding = `0 ${escapeAttr(String(rightPad))}px 0 0`;

    if (icon.platform === "custom") {
      // No `name`: MJML's network palette and href defaults must not apply.
      const imageUrl = emittedImageUrl(icon) ?? "";
      return `<mj-social-element src="${escapeAttr(imageUrl)}" alt="${escapeAttr(altText(icon))}" href="${url}" icon-size="${iconSizePx}px" padding="${padding}" border-radius="0" background-color="transparent"></mj-social-element>`;
    }

    const platform = escapeAttr(icon.platform);
    const iconSrc = `${context.socialIconsBaseUrl}/${assetDir}/${platform}.png`;

    // Empty content hides the platform name text, matching the editor display
    return `<mj-social-element src="${iconSrc}" href="${url}" icon-size="${iconSizePx}px" padding="${padding}" border-radius="${borderRadius}" background-color="transparent"></mj-social-element>`;
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
