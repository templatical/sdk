/**
 * Extract video ID and thumbnail URL from common video platforms
 */

interface VideoInfo {
  platform: "youtube" | "vimeo" | "unknown";
  videoId: string | null;
  thumbnailUrl: string | null;
}

export function parseVideoUrl(url: string): VideoInfo {
  if (!url) {
    return { platform: "unknown", videoId: null, thumbnailUrl: null };
  }

  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        platform: "youtube",
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    }
  }

  // Vimeo patterns
  const vimeoPattern = /vimeo\.com\/(?:video\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoPattern);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      platform: "vimeo",
      videoId,
      // Vimeo requires API call for thumbnail, use placeholder
      thumbnailUrl: `https://vumbnail.com/${videoId}.jpg`,
    };
  }

  return { platform: "unknown", videoId: null, thumbnailUrl: null };
}

export function getVideoThumbnail(
  url: string,
  customThumbnail?: string,
): string | null {
  // Custom thumbnail takes priority
  if (customThumbnail) {
    return customThumbnail;
  }

  const info = parseVideoUrl(url);
  return info.thumbnailUrl;
}
