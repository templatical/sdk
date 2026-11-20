import type { CountdownBlock } from "@templatical/types";
import { countdownAltText } from "@templatical/types";
import { escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { getCssClassAttr, isHiddenOnAll } from "../visibility";
import { renderUnrenderableBlock } from "../unrenderable";

/** Render a host-provided countdown image with recipient-facing alt text. */
export function renderCountdownImage(
  block: CountdownBlock,
  src: string,
  options?: { locale?: string },
): string {
  if (isHiddenOnAll(block)) return "";
  if (typeof src !== "string" || src.trim() === "") {
    return renderUnrenderableBlock(block);
  }

  const alt = countdownAltText(block, options?.locale);
  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const visibility = getCssClassAttr(block);

  // The countdown has no stored width. MJML reads the image's own dimensions;
  // full-width mobile behavior lets a large GIF fit a narrow column.
  return `<mj-image
  src="${escapeAttr(src)}"
  alt="${escapeAttr(alt)}"
  fluid-on-mobile="true"
  align="center"
  padding="${padding}"${bgColor}${visibility}
/>`;
}
