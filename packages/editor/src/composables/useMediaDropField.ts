import {
  computed,
  inject,
  ref,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import type { MediaResult } from "@templatical/types";
import { CAN_DROP_MEDIA_KEY, ON_REQUEST_MEDIA_KEY } from "../keys";
import { useAliveFlag } from "./useAliveFlag";
import { useImageDrop } from "./useImageDrop";

export interface UseMediaDropFieldOptions {
  /** The drop target element (a template ref). */
  target: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * Turns drop off for this field on top of the media gates, e.g. for a
   * merge-tag value (a deliberate dynamic value a drop must never clobber) or
   * a read-only field. Browse is unaffected.
   */
  blocked?: MaybeRefOrGetter<boolean>;
  /**
   * Writes a picked or uploaded image into the field. Not called when the
   * request is cancelled or the component has unmounted while it ran.
   */
  apply: (result: MediaResult) => void;
}

export interface UseMediaDropFieldReturn {
  /** Whether the host handles media requests, so Browse can render. */
  canBrowse: boolean;
  /** Whether a drop would be accepted right now. */
  dropEnabled: ComputedRef<boolean>;
  /** True while a dropped image uploads. */
  isUploading: Readonly<Ref<boolean>>;
  /** Whether the drag-over or uploading overlay shows. */
  showOverlay: ComputedRef<boolean>;
  /** Opens the host's media browser and applies the picked image. */
  openMediaBrowser: () => Promise<void>;
}

/**
 * Browse and drag-and-drop upload for an image URL field (#229). Both go
 * through the injected `onRequestMedia`: Browse asks it to pick an image, a
 * drop hands it the file to upload, and either way the returned `MediaResult`
 * goes to `apply`.
 *
 * Browse and drop are gated separately: a read-only provider still opens the
 * library, but `canDropMedia` is false so the zone does not highlight. Drop is
 * also off while an upload runs, so a second drop can't race it, and while
 * `blocked` holds.
 */
export function useMediaDropField(
  options: UseMediaDropFieldOptions,
): UseMediaDropFieldReturn {
  const { target, blocked, apply } = options;
  const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
  const canDropMedia = inject(CAN_DROP_MEDIA_KEY, null);
  const aliveFlag = useAliveFlag();

  async function openMediaBrowser(): Promise<void> {
    const result = await onRequestMedia?.({ accept: ["images"] });
    if (!aliveFlag.alive) return;
    if (result) apply(result);
  }

  const isUploading = ref(false);
  const dropEnabled = computed(
    () =>
      (canDropMedia?.value ?? !!onRequestMedia) &&
      !isUploading.value &&
      !toValue(blocked),
  );

  async function uploadDroppedFiles(files: File[]): Promise<void> {
    if (!onRequestMedia) return;
    isUploading.value = true;
    try {
      const result = await onRequestMedia({ accept: ["images"], files });
      if (!aliveFlag.alive) return;
      if (result) apply(result);
    } finally {
      if (aliveFlag.alive) isUploading.value = false;
    }
  }

  const { isOver } = useImageDrop({
    target,
    enabled: dropEnabled,
    onFiles: uploadDroppedFiles,
  });

  // Uploading counts on its own: drop is off while an upload runs, so gating
  // it on `dropEnabled` would hide the uploading state.
  const showOverlay = computed(
    () => (dropEnabled.value && isOver.value) || isUploading.value,
  );

  return {
    canBrowse: !!onRequestMedia,
    dropEnabled,
    isUploading,
    showOverlay,
    openMediaBrowser,
  };
}
