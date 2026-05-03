import type { VideoBlock } from "@templatical/types";
import type { RenderContext } from "../render-context";
import { escapeAttr } from "../escape";
import { toPaddingString } from "../padding";
import { bgAttr } from "../utils";
import { isHiddenOnAll, getCssClassAttr } from "../visibility";

/**
 * Extract video thumbnail URL from common platforms.
 * Works without server-side processing — YouTube and Vimeo thumbnails are publicly accessible.
 */
function getVideoThumbnail(
  url: string,
  customThumbnail?: string,
): string | null {
  if (customThumbnail) {
    return customThumbnail;
  }

  if (!url) {
    return null;
  }

  // YouTube
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    }
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  }

  return null;
}

/**
 * Render a video block to MJML markup.
 * Videos in email are rendered as a linked thumbnail image pointing to the video URL.
 */
export function renderVideo(block: VideoBlock, context: RenderContext): string {
  if (isHiddenOnAll(block)) {
    return "";
  }

  const thumbnailUrl = getVideoThumbnail(block.url, block.thumbnailUrl);

  if (!thumbnailUrl) {
    return "";
  }

  const padding = toPaddingString(block.styles.padding);
  const bgColor = bgAttr(block.styles.backgroundColor, "container");
  const width =
    block.width === "full" ? context.containerWidth + "px" : block.width + "px";
  const visibilityAttr = getCssClassAttr(block);

  const src = escapeAttr(thumbnailUrl);
  const alt = escapeAttr(block.alt);
  const align = block.align;
  const href = escapeAttr(block.url);

  return `<mj-image
  src="${src}"
  alt="${alt}"
  width="${width}"
  align="${align}"
  padding="${padding}"
  href="${href}"
  target="_blank"${bgColor}${visibilityAttr}
/>`;
}
