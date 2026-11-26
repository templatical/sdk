import { computed, onScopeDispose, ref, watch } from "vue";

export const COUNTDOWN_IMAGE_DEBOUNCE_MS = 400;

function normalizeUrl(url: string | undefined): string {
  return url?.trim() ? url : "";
}

/**
 * Preload the current countdown URL before replacing the canvas image.
 * `targetUrl` is the debounced URL that starts a request; `latestUrl` is the
 * undebounced one. A completion counts only while its URL is still the latest,
 * so a request that finishes during the debounce window never lands.
 */
export function useCountdownImage(
  targetUrl: () => string | undefined,
  latestUrl: () => string | undefined = targetUrl,
) {
  const target = computed(() => normalizeUrl(targetUrl()));
  const latest = computed(() => normalizeUrl(latestUrl()));
  const shownUrl = ref("");
  const isUpdating = ref(false);
  const failedUrl = ref("");
  let preloader: HTMLImageElement | null = null;
  // A completion that arrived while its URL was not the latest. It applies if
  // the latest URL returns to it before the debounced target moves; the target
  // then stays put, so no new request would ever settle the state.
  let heldResult: { url: string; loaded: boolean } | null = null;

  function settle(url: string, loaded: boolean) {
    isUpdating.value = false;
    if (loaded) {
      shownUrl.value = url;
      failedUrl.value = "";
    } else {
      failedUrl.value = url;
    }
  }

  function complete(url: string, loaded: boolean) {
    if (latest.value !== url) {
      heldResult = { url, loaded };
      return;
    }
    settle(url, loaded);
  }

  function cancelPreloader() {
    heldResult = null;
    if (!preloader) return;
    preloader.onload = null;
    preloader.onerror = null;
    preloader.src = "";
    preloader = null;
  }

  watch(
    target,
    (url) => {
      cancelPreloader();
      failedUrl.value = "";
      if (!url) {
        shownUrl.value = "";
        isUpdating.value = false;
        return;
      }
      if (url === shownUrl.value) {
        isUpdating.value = false;
        return;
      }

      isUpdating.value = true;
      const image = new Image();
      preloader = image;
      image.onload = () => complete(url, true);
      image.onerror = () => complete(url, false);
      image.src = url;
    },
    { immediate: true },
  );

  watch(latest, (url) => {
    if (!heldResult || heldResult.url !== url) return;
    const held = heldResult;
    heldResult = null;
    settle(held.url, held.loaded);
  });

  onScopeDispose(cancelPreloader);
  return { shownUrl, isUpdating, failedUrl };
}
