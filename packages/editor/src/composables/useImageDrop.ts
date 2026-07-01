import {
  computed,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import { useDropZone } from "@vueuse/core";

export interface UseImageDropOptions {
  /** The drop target element (a template ref). */
  target: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Called with the dropped image file(s). The editor acts on a single file
   * per drop (`files[0]`), but the array shape is kept for forward-compat.
   */
  onFiles: (files: File[]) => void;
  /**
   * Gate the zone. While falsy the drop is inert: no highlight, dropped files
   * are ignored. Components pass `canBrowseMedia && !isUploading` so a missing
   * media handler renders no affordance and a second drop can't race an
   * in-flight upload.
   */
  enabled?: MaybeRefOrGetter<boolean>;
}

export interface UseImageDropReturn {
  /** True while an image drag hovers the (enabled) target — drive the highlight. */
  isOver: ComputedRef<boolean>;
}

const IMAGE_MIME_PREFIX = "image/";

/**
 * Drag-and-drop image upload onto an image block/field (#229). Wraps
 * `useDropZone`; filters dropped files to image MIME types client-side (the
 * authoritative size/type check stays server/plan-config side) and forwards
 * the first image to `onFiles`. The caller hands the file to `onRequestMedia`,
 * which uploads it and returns a `MediaResult` — identical to the Browse Media
 * path, only the input differs.
 *
 * `preventDefaultForUnhandled` keeps the browser from navigating to the dropped
 * file even for a non-image drop on the zone; the editor-root guard covers
 * drops that land outside any zone.
 */
export function useImageDrop(options: UseImageDropOptions): UseImageDropReturn {
  const { target, onFiles, enabled } = options;

  const isEnabled = (): boolean =>
    enabled === undefined ? true : toValue(enabled);

  const { isOverDropZone } = useDropZone(target, {
    preventDefaultForUnhandled: true,
    onDrop: (files) => {
      if (!isEnabled()) return;
      const images = (files ?? []).filter((file) =>
        file.type.startsWith(IMAGE_MIME_PREFIX),
      );
      if (images.length > 0) onFiles([images[0]]);
    },
  });

  const isOver = computed(() => isEnabled() && isOverDropZone.value);

  return { isOver };
}
