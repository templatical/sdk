import { ref, watch, type Ref } from "vue";
import { toNaturalSize, type NaturalSize } from "../utils/imageNaturalSize";

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
  let token = 0;

  watch(
    url,
    (value) => {
      const current = ++token;
      size.value = null;
      if (!value || typeof Image === "undefined") return;
      const image = new Image();
      image.onload = () => {
        if (current !== token) return;
        size.value = toNaturalSize(image.naturalWidth, image.naturalHeight);
      };
      image.src = value;
    },
    { immediate: true },
  );

  return size;
}
