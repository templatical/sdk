import {
  computed,
  inject,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from "vue";
import type { MediaResult } from "@templatical/types";
import { CAN_DROP_MEDIA_KEY, ON_REQUEST_MEDIA_KEY } from "../keys";
import { useAliveFlag } from "./useAliveFlag";
import { useImageDrop } from "./useImageDrop";

export interface UseMediaDropFieldOptions {
  /** The drop target element (a template ref). */
  target: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * The URL the field holds now. A drop upload applies only if the field still
   * holds the value it had when the file was dropped, so an upload that
   * finishes late never overwrites a URL typed, picked or dropped elsewhere
   * while it ran (the canvas image and its toolbar field are two drop zones on
   * one `src`).
   */
  value: MaybeRefOrGetter<string>;
  /**
   * Turns drop off for this field on top of the media gates, e.g. for a
   * merge-tag value (a deliberate dynamic value a drop must never clobber) or
   * a read-only field. Browse is unaffected.
   */
  blocked?: MaybeRefOrGetter<boolean>;
  /**
   * Writes a picked or uploaded image into the field. Not called when the
   * request is cancelled, when the component has unmounted while it ran, or for
   * a drop upload whose field value changed meanwhile.
   */
  apply: (result: MediaResult) => void;
}

export interface UseMediaDropFieldReturn {
  /** Whether the host handles media requests, so Browse can render. */
  canBrowse: boolean;
  /** Whether a drop would be accepted right now. */
  dropEnabled: ComputedRef<boolean>;
  /**
   * True while a dropped image uploads and can still land: it turns false as
   * soon as the field's value changes, since the result is then discarded.
   */
  isUploading: ComputedRef<boolean>;
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
 * also off while an upload that can still land runs, and while `blocked` holds.
 *
 * A drop upload is checked against `value` when it finishes, never a Browse
 * pick: the pick is the user's latest action, so it applies whatever the field
 * held while the picker was open, and it replaces any pending drop.
 */
export function useMediaDropField(
  options: UseMediaDropFieldOptions,
): UseMediaDropFieldReturn {
  const { target, value, blocked, apply } = options;
  const onRequestMedia = inject(ON_REQUEST_MEDIA_KEY, null);
  const canDropMedia = inject(CAN_DROP_MEDIA_KEY, null);
  const aliveFlag = useAliveFlag();

  // The latest drop's upload and the value it was dropped onto. Once the value
  // moves on, that upload is stale: the overlay clears and drop re-enables. A
  // newer drop or a Browse pick in this field replaces the entry, so an older
  // upload never lands over it, even when the newer one set the URL it was
  // dropped on.
  const pendingDrop = shallowRef<{ before: string } | null>(null);

  async function openMediaBrowser(): Promise<void> {
    const result = await onRequestMedia?.({ accept: ["images"] });
    if (!aliveFlag.alive) return;
    if (!result) return;
    pendingDrop.value = null;
    apply(result);
  }

  const isUploading = computed(
    () =>
      pendingDrop.value !== null && toValue(value) === pendingDrop.value.before,
  );
  const dropEnabled = computed(
    () =>
      (canDropMedia?.value ?? !!onRequestMedia) &&
      !isUploading.value &&
      !toValue(blocked),
  );

  async function uploadDroppedFiles(files: File[]): Promise<void> {
    if (!onRequestMedia) return;
    const drop = { before: toValue(value) };
    pendingDrop.value = drop;
    try {
      const result = await onRequestMedia({ accept: ["images"], files });
      if (!aliveFlag.alive) return;
      if (
        result &&
        pendingDrop.value === drop &&
        toValue(value) === drop.before
      ) {
        apply(result);
      }
    } finally {
      if (aliveFlag.alive && pendingDrop.value === drop) {
        pendingDrop.value = null;
      }
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
