import {
  computed,
  getCurrentScope,
  inject,
  onScopeDispose,
  reactive,
  watch,
  type ComputedRef,
} from "vue";
import { IMAGE_URL_RESOLVER_KEY } from "../keys";
import { RESOLVE_IMAGE_DEBOUNCE_MS } from "../constants/timeouts";

/**
 * Display-only resolver for image `src` values (`config.resolveImageUrl`,
 * #415). Maps a canonical src (e.g. a plain file name like `logo.png`) to a
 * URL the canvas can actually display (e.g. an ephemeral `blob:` URL).
 * Returning `null` (or the input value) means "use the src as-is". The
 * resolved value never enters the content model or the MJML export.
 */
export type ResolveImageUrl = (
  src: string,
) => string | null | Promise<string | null>;

/**
 * Per-editor cache around the host's `resolveImageUrl` callback. Each src is
 * resolved at most once for the editor's lifetime — repeated lookups (same
 * image in several blocks, re-mounts while scrolling) hit the cache, and a
 * failed lookup caches `null` so the host service is never hammered with
 * retries for the same value.
 */
export interface ImageUrlResolver {
  /**
   * Cached result for a src: the resolved URL, `null` for "use as-is"
   * (also the failure fallback), or `undefined` when the src was never
   * looked up or the lookup is still in flight.
   */
  get(src: string): string | null | undefined;
  /** True when the src is cached or a lookup for it is in flight. */
  has(src: string): boolean;
  /** Start a lookup unless the src is already cached or in flight. */
  lookup(src: string): void;
}

export function createImageUrlResolver(
  resolve: ResolveImageUrl,
): ImageUrlResolver {
  // Reactive so `useResolvedImageSrc`'s computed re-evaluates when an async
  // lookup settles into the cache.
  const cache = reactive(new Map<string, string | null>());
  const inFlight = new Set<string>();

  function get(src: string): string | null | undefined {
    return cache.get(src);
  }

  function has(src: string): boolean {
    return cache.has(src) || inFlight.has(src);
  }

  function lookup(src: string): void {
    if (has(src)) return;

    let result: string | null | Promise<string | null>;
    try {
      result = resolve(src);
    } catch {
      cache.set(src, null);
      return;
    }

    if (result === null || typeof result === "string") {
      cache.set(src, result);
      return;
    }

    inFlight.add(src);
    Promise.resolve(result)
      .then(
        (value) => {
          // Normalize a misbehaving resolver (undefined, non-string) to null.
          cache.set(src, typeof value === "string" ? value : null);
        },
        () => {
          cache.set(src, null);
        },
      )
      .finally(() => inFlight.delete(src));
  }

  return { get, has, lookup };
}

/**
 * Component-facing display value for an image src. Passes the src through
 * unchanged when no `resolveImageUrl` is configured. With a resolver, the
 * returned computed shows the resolved preview URL once available and the
 * canonical src otherwise (while pending, or when the resolver opted out
 * with `null`).
 *
 * Lookup cadence: the initial src resolves immediately (template load),
 * subsequent changes are debounced by `RESOLVE_IMAGE_DEBOUNCE_MS` so typing
 * in the src input never sends partial values (`lo`, `logo.p`, …) to the
 * host resolver. Already-cached values apply instantly either way.
 *
 * Pass `undefined` from the getter to opt a value out of resolution
 * entirely (e.g. a merge-tag src, which is never displayable).
 */
export function useResolvedImageSrc(
  src: () => string | undefined,
): ComputedRef<string | undefined> {
  const resolver = inject(IMAGE_URL_RESOLVER_KEY, null);
  const srcRef = computed(src);
  if (!resolver) return srcRef;

  let timer: ReturnType<typeof setTimeout> | undefined;
  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }
  if (getCurrentScope()) {
    onScopeDispose(clearTimer);
  }

  let initial = true;
  watch(
    srcRef,
    (value) => {
      clearTimer();
      const immediate = initial;
      initial = false;
      if (!value || resolver.has(value)) return;
      if (immediate) {
        resolver.lookup(value);
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        resolver.lookup(value);
      }, RESOLVE_IMAGE_DEBOUNCE_MS);
    },
    { immediate: true },
  );

  return computed(() => {
    const value = srcRef.value;
    if (!value) return value;
    const resolved = resolver.get(value);
    return typeof resolved === "string" && resolved.length > 0
      ? resolved
      : value;
  });
}
