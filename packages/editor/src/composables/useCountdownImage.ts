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

  function cancelPreloader() {
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
      image.onload = () => {
        if (latest.value !== url) return;
        shownUrl.value = url;
        isUpdating.value = false;
        failedUrl.value = "";
      };
      image.onerror = () => {
        if (latest.value !== url) return;
        isUpdating.value = false;
        failedUrl.value = url;
      };
      image.src = url;
    },
    { immediate: true },
  );

  onScopeDispose(cancelPreloader);
  return { shownUrl, isUpdating, failedUrl };
}
