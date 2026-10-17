import { vi } from "vitest";

/** How long a stubbed image takes to "load", so a test can act mid-load. */
export const FAKE_IMAGE_LOAD_MS = 50;

/**
 * Replace the global `Image` so `loadNaturalSize` resolves from `sizes`, keyed
 * by URL; any other URL fails to load. happy-dom never loads images itself.
 * Undo with `vi.unstubAllGlobals()`.
 */
export function stubImages(
  sizes: Record<string, { width: number; height: number }>,
): { requested: string[] } {
  const requested: string[] = [];

  class FakeImage {
    naturalWidth = 0;
    naturalHeight = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(value: string) {
      requested.push(value);
      setTimeout(() => {
        const size = sizes[value];
        if (!size) {
          this.onerror?.();
          return;
        }
        this.naturalWidth = size.width;
        this.naturalHeight = size.height;
        this.onload?.();
      }, FAKE_IMAGE_LOAD_MS);
    }
  }

  vi.stubGlobal("Image", FakeImage);
  return { requested };
}
