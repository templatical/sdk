import type { ImageBlock } from "@templatical/types";
import { NATURAL_SIZE_TIMEOUT_MS } from "../constants/timeouts";

export interface NaturalSize {
  width: number;
  height: number;
}

function isSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * A width and height as a natural size, or `null` unless both are positive
 * numbers: one without the other says nothing about the ratio.
 */
export function toNaturalSize(
  width: unknown,
  height: unknown,
): NaturalSize | null {
  return isSize(width) && isSize(height) ? { width, height } : null;
}

/** The size of the file an image block shows, when the block stores one. */
export function naturalSizeOf(
  block: Pick<ImageBlock, "naturalWidth" | "naturalHeight">,
): NaturalSize | null {
  return toNaturalSize(block.naturalWidth, block.naturalHeight);
}

/**
 * The block fields for a natural size: both set, or both cleared. Written in
 * the same update as `src`, so a size from the previous file never outlives it.
 */
export function naturalSizeFields(
  size: NaturalSize | null,
): Pick<ImageBlock, "naturalWidth" | "naturalHeight"> {
  return size
    ? { naturalWidth: size.width, naturalHeight: size.height }
    : { naturalWidth: undefined, naturalHeight: undefined };
}

/**
 * Load `url` in an `Image` and pass its natural size to `done`, or `null` when
 * it fails to load or reports no size (a broken image reads 0 × 0). Only the
 * size is read, never the pixels, so a cross-origin image needs no CORS
 * headers. The returned function stops listening; `done` is then never called.
 */
export function loadNaturalSize(
  url: string,
  done: (size: NaturalSize | null) => void,
): () => void {
  if (typeof Image === "undefined") {
    done(null);
    return () => {};
  }
  const image = new Image();
  const stop = (): void => {
    image.onload = null;
    image.onerror = null;
  };
  image.onload = () => {
    stop();
    done(toNaturalSize(image.naturalWidth, image.naturalHeight));
  };
  image.onerror = () => {
    stop();
    done(null);
  };
  image.src = url;
  return stop;
}

/**
 * The natural size of the image at `url` (`loadNaturalSize`), or `null` once
 * `NATURAL_SIZE_TIMEOUT_MS` passes without a load, so a stalled image never
 * leaves a measurement pending.
 */
export function measureNaturalSize(url: string): Promise<NaturalSize | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, NATURAL_SIZE_TIMEOUT_MS);
    const stop = loadNaturalSize(url, (size) => {
      clearTimeout(timer);
      resolve(size);
    });
  });
}
