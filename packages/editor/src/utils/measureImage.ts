/** An image's natural size in px. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Load `url` and read its natural size; `null` when it fails to load or
 * reports no size. Only the size is read, never the pixels, so a
 * cross-origin image needs no CORS headers.
 */
export function measureImage(url: string): Promise<ImageSize | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null,
      );
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
