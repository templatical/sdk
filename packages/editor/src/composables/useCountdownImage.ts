import { computed, onScopeDispose, ref, watch } from "vue";

export const COUNTDOWN_IMAGE_DEBOUNCE_MS = 400;

/** Preload the current countdown URL before replacing the canvas image. */
export function useCountdownImage(targetUrl: () => string) {
  const target = computed(() => {
    const url = targetUrl();
    return url.trim() ? url : "";
  });
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
        if (target.value !== url) return;
        shownUrl.value = url;
        isUpdating.value = false;
        failedUrl.value = "";
      };
      image.onerror = () => {
        if (target.value !== url) return;
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
