import { inject, ref, watch, type Ref } from "vue";
import { IMAGE_URL_RESOLVER_KEY } from "../keys";
import {
  loadNaturalSize,
  measureNaturalSize,
  type NaturalSize,
} from "../utils/imageNaturalSize";
import type { ImageUrlResolver } from "./useImageUrlResolver";

/**
 * The natural size of the image at `url`, measured by loading it in an
 * `Image` (reading `naturalWidth` needs no CORS). `null` while it loads, when
 * it fails, and whenever `url` is `undefined`. A load that finishes after
 * `url` has moved on is dropped.
 *
 * Display-only: the result lives in component state. Writing it into the
 * block on load would mark the template dirty and add an undo step just for
 * opening it, so the caller persists it only inside an edit.
 */
export function useNaturalImageSize(
  url: () => string | undefined,
): Ref<NaturalSize | null> {
  const size = ref<NaturalSize | null>(null);
  let stop = (): void => {};

  watch(
    url,
    (value) => {
      stop();
      size.value = null;
      if (!value) return;
      stop = loadNaturalSize(value, (measured) => {
        size.value = measured;
      });
    },
    { immediate: true },
  );

  return size;
}

/**
 * A function that measures the natural size of the image a stored URL names
 * (`measureNaturalSize`), for an edit that stores the size. With a
 * `resolveImageUrl` configured, the stored URL may not load on its own (a
 * plain `logo.png`), so it measures the URL the canvas displays. Call it from
 * a user action, never a watcher: storing the size edits the template.
 */
export function useMeasureNaturalSize(): (
  url: string,
) => Promise<NaturalSize | null> {
  const resolver = inject(IMAGE_URL_RESOLVER_KEY, null);
  return async (url) =>
    measureNaturalSize(resolver ? await displayUrl(resolver, url) : url);
}

/** The display URL for `url` once the resolver settles; `url` itself when it opts out. */
function displayUrl(resolver: ImageUrlResolver, url: string): Promise<string> {
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
