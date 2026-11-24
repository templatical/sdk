import type { MediaRequestContext, MediaResult } from "../types";
import { computed, inject, ref, type ComputedRef, type Ref } from "vue";

export interface UseMediaPickerReturn {
  isPluggableMediaEnabled: ComputedRef<boolean>;
  isRequesting: Ref<boolean>;
  requestMedia: (context?: MediaRequestContext) => Promise<MediaResult | null>;
}

export function useMediaPicker(): UseMediaPickerReturn {
  const onRequestMedia = inject<
    ((context: MediaRequestContext) => Promise<MediaResult | null>) | undefined
  >("onRequestMedia");
  const isRequesting = ref(false);

  // A configured handler is the whole condition: the host owns the picker
  // and can use it whenever it supplies the callback.
  const isPluggableMediaEnabled = computed(() => !!onRequestMedia);

  async function requestMedia(
    context?: MediaRequestContext,
  ): Promise<MediaResult | null> {
    if (!onRequestMedia) {
      return null;
    }

    isRequesting.value = true;
    try {
      return await onRequestMedia(context ?? {});
    } finally {
      isRequesting.value = false;
    }
  }

  return { isPluggableMediaEnabled, isRequesting, requestMedia };
}
