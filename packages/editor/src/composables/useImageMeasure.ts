import { inject, watch } from "vue";
import { IMAGE_URL_RESOLVER_KEY } from "../keys";
import { measureImage, type ImageSize } from "../utils/measureImage";
import type { ImageUrlResolver } from "./useImageUrlResolver";

/**
 * A function that measures an image's natural size by its stored URL. With a
 * `resolveImageUrl` configured, the stored URL may not load on its own (a
 * plain `logo.png`), so it measures the URL the canvas displays. Call it from
 * a user action, never a watcher: storing the size edits the template.
 */
export function useImageMeasure(): (url: string) => Promise<ImageSize | null> {
  const resolver = inject(IMAGE_URL_RESOLVER_KEY, null);
  return async (url) => {
    const display = resolver ? await resolvedUrl(resolver, url) : url;
    return measureImage(display);
  };
}

/** The display URL for `url` once the resolver settles; `url` itself when it opts out. */
function resolvedUrl(resolver: ImageUrlResolver, url: string): Promise<string> {
  const settled = (value: string | null): string =>
    typeof value === "string" && value.length > 0 ? value : url;

  resolver.lookup(url);
  const cached = resolver.get(url);
  if (cached !== undefined) return Promise.resolve(settled(cached));

  // A lookup always settles: a failure caches `null` (useImageUrlResolver).
  return new Promise((resolve) => {
    const stop = watch(
      () => resolver.get(url),
      (value) => {
        if (value === undefined) return;
        stop();
        resolve(settled(value));
      },
    );
  });
}
