import type { ImageBlock } from "@templatical/types";

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
