import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import type { ImageBlock } from "@templatical/types";
import {
  naturalSizeFields,
  naturalSizeOf,
  type NaturalSize,
} from "../utils/imageNaturalSize";

export interface UseImageAspectLockOptions {
  block: () => ImageBlock;
  /** What the image can span on desktop (`imageRoom`); `null` when unknown. */
  room: () => number | null;
  /** A size measured in the editor, used when the block stores none. */
  measured: () => NaturalSize | null;
}

export interface UseImageAspectLockReturn {
  /** The file's ratio is known, so the lock can be offered. */
  available: ComputedRef<boolean>;
  locked: ComputedRef<boolean>;
  /** The height the image shows at, from its width and the file's ratio. */
  derivedHeight: ComputedRef<number | null>;
  /** Set when the last height edit was capped at the column. */
  cappedHeight: Ref<number | null>;
  /** The updates for turning the lock on or off; `null` when there are none. */
  setLocked: (on: boolean) => Partial<ImageBlock> | null;
  /** The updates for a new width. Under the lock the height is left on Auto. */
  widthUpdates: (width: ImageBlock["width"]) => Partial<ImageBlock>;
  /** The updates for a typed height under the lock; `null` for an unusable value. */
  heightUpdates: (height: number) => Partial<ImageBlock> | null;
}

/**
 * The image toolbar's aspect-ratio lock. Under the lock only the width is
 * stored and the height stays on Auto: a stored height, even one that matches
 * the ratio, squashes an image wider than a phone's column, because MJML
 * shrinks the width to fit and keeps a stated height (500 × 167 renders
 * 355 × 167 at 375px). A typed height becomes a width; one that reaches the
 * column's room becomes `"full"`, which is where MJML caps it.
 *
 * Locked is derived, not stored: the ratio is known and the stored height is
 * unset or already matches it. A legacy block with a mismatched height opens
 * unlocked. Turning the lock off holds for as long as the block stays selected.
 */
export function useImageAspectLock(
  options: UseImageAspectLockOptions,
): UseImageAspectLockReturn {
  const userUnlocked = ref(false);
  const cappedHeight = ref<number | null>(null);

  watch(
    () => options.block().id,
    () => {
      userUnlocked.value = false;
      cappedHeight.value = null;
    },
  );

  const size = computed(
    () => naturalSizeOf(options.block()) ?? options.measured(),
  );

  const shownWidth = computed(() => {
    const width = options.block().width;
    return width === "full" ? options.room() : width;
  });

  const derivedHeight = computed(() => {
    const ratio = size.value;
    const width = shownWidth.value;
    if (!ratio || width === null) return null;
    return Math.round((width * ratio.height) / ratio.width);
  });

  const available = computed(() => size.value !== null);

  const matchesRatio = computed(() => {
    const height = options.block().height;
    if (height === undefined) return true;
    return derivedHeight.value !== null
      ? Math.abs(derivedHeight.value - height) <= 1
      : false;
  });

  const locked = computed(
    () => available.value && !userUnlocked.value && matchesRatio.value,
  );

  // A measured size is written only alongside an edit that uses it.
  function persistedSize(): Partial<ImageBlock> {
    if (naturalSizeOf(options.block())) return {};
    const measured = options.measured();
    return measured ? naturalSizeFields(measured) : {};
  }

  function setLocked(on: boolean): Partial<ImageBlock> | null {
    cappedHeight.value = null;
    if (!on) {
      userUnlocked.value = true;
      return null;
    }
    userUnlocked.value = false;
    if (!available.value) return null;
    const updates: Partial<ImageBlock> = { ...persistedSize() };
    if (options.block().height !== undefined) updates.height = undefined;
    return Object.keys(updates).length > 0 ? updates : null;
  }

  function widthUpdates(width: ImageBlock["width"]): Partial<ImageBlock> {
    cappedHeight.value = null;
    if (!locked.value) return { width };
    return { width, height: undefined, ...persistedSize() };
  }

  function heightUpdates(height: number): Partial<ImageBlock> | null {
    const ratio = size.value;
    if (!locked.value || !ratio || !Number.isFinite(height) || height <= 0) {
      return null;
    }
    const width = Math.round((height * ratio.width) / ratio.height);
    if (width < 1) return null;
    const room = options.room();
    if (room !== null && width >= room) {
      cappedHeight.value = Math.round((room * ratio.height) / ratio.width);
      return { width: "full", height: undefined, ...persistedSize() };
    }
    cappedHeight.value = null;
    return { width, height: undefined, ...persistedSize() };
  }

  return {
    available,
    locked,
    derivedHeight,
    cappedHeight,
    setLocked,
    widthUpdates,
    heightUpdates,
  };
}
