import type { MediaCategory } from "../types";
import { computed, inject, type ComputedRef } from "vue";
import { MEDIA_LIMITS_KEY, type MediaLimits } from "../keys";

export type { MediaCategory };

/** Category tabs when the host set no `accept` and the provider set no `mimeTypes`. */
const ALL_CATEGORIES: MediaCategory[] = [
  "images",
  "documents",
  "videos",
  "audio",
];

export interface UseMediaCategoriesReturn {
  isMediaLibraryEnabled: ComputedRef<boolean>;
  allAcceptedMimeTypes: ComputedRef<string[]>;
  allAcceptedInputString: ComputedRef<string>;
  maxFileSize: ComputedRef<number>;
  availableCategories: ComputedRef<MediaCategory[]>;
  isAcceptedMimeType: (mimeType: string, accept?: MediaCategory[]) => boolean;
  isAcceptedFile: (file: { type: string; size: number }) => boolean;
  isImageMimeType: (mimeType: string) => boolean;
  getCategoryForMimeType: (mimeType: string) => MediaCategory | null;
}

export function useMediaCategories(
  /**
   * The limits to read, for callers that cannot inject them.
   *
   * A component never sees its own `provide` — Vue resolves `inject` against
   * the *parent* chain — so the two hosts that provide `MEDIA_LIMITS_KEY`
   * cannot also inject it, and must pass their value here instead. Descendants
   * (`MediaGrid`, `MediaEditModal`, `MediaUploadZone`, `MediaPreviewPanel`)
   * omit the argument and inject. Mirrors `useI18n(override?)`.
   */
  limitsOverride?: MediaLimits,
): UseMediaCategoriesReturn {
  // Explicit null default + throw rather than a `!` assertion: without a
  // provider every read below became `undefined.maxFileSize`. Reaching this
  // message means a descendant was rendered outside both hosts, or a host
  // forgot the argument above.
  const injected = limitsOverride ?? inject(MEDIA_LIMITS_KEY, null);
  if (!injected) {
    throw new Error(
      "[Templatical] useMediaCategories() needs media limits in scope. Render it under <MediaLibraryModal> or provide MEDIA_LIMITS_KEY yourself.",
    );
  }
  // Nested functions below close over this; a narrowed `const` from the
  // throw is not carried into them (TS18047).
  const limits: MediaLimits = injected;

  // A provider in scope *is* the feature being on — there is no separate
  // `useMediaLibrary` flag. The composable cannot be constructed without
  // limits, so this is constantly true for every successful caller.
  const isMediaLibraryEnabled = computed(() => true);

  // Read `maxFileSize` / `mimeTypes` / `accept` *inside* the computed. Cloud
  // implements the first two as getters over plan config that arrives after
  // construction; capturing them at setup pins the client pre-check to
  // `undefined` for the whole session.
  // Omit is no cap (`??`, so an explicit `0` stays a cap of 0). Infinity
  // keeps `ComputedRef<number>` and `file.size <= n` without a skip branch.
  const maxFileSize = computed(
    () => limits.maxFileSize ?? Number.POSITIVE_INFINITY,
  );

  const availableCategories = computed((): MediaCategory[] => {
    const accept = limits.accept;
    if (accept && accept.length > 0) {
      return accept;
    }
    const mimeTypes = limits.mimeTypes;
    if (mimeTypes) {
      return Object.keys(mimeTypes) as MediaCategory[];
    }
    return ALL_CATEGORIES;
  });

  const allAcceptedMimeTypes = computed(() => {
    const mimeTypes = limits.mimeTypes;
    if (!mimeTypes) {
      return [];
    }
    return availableCategories.value.flatMap(
      (category) => mimeTypes[category] ?? [],
    );
  });

  const allAcceptedInputString = computed(() =>
    allAcceptedMimeTypes.value.join(","),
  );

  function isAcceptedMimeType(
    mimeType: string,
    accept?: MediaCategory[],
  ): boolean {
    const mimeTypes = limits.mimeTypes;
    if (!mimeTypes) {
      return true;
    }

    const categories =
      accept && accept.length > 0
        ? accept
        : (Object.keys(mimeTypes) as MediaCategory[]);

    return categories.some(
      (category) => mimeTypes[category]?.includes(mimeType) ?? false,
    );
  }

  function isAcceptedFile(file: { type: string; size: number }): boolean {
    return isAcceptedMimeType(file.type) && file.size <= maxFileSize.value;
  }

  function isImageMimeType(mimeType: string): boolean {
    const mimeTypes = limits.mimeTypes;
    if (!mimeTypes) {
      return mimeType.startsWith("image/");
    }
    return mimeTypes.images?.includes(mimeType) ?? false;
  }

  function getCategoryForMimeType(mimeType: string): MediaCategory | null {
    const mimeTypes = limits.mimeTypes;
    if (!mimeTypes) {
      return null;
    }

    for (const [category, types] of Object.entries(mimeTypes)) {
      if (types?.includes(mimeType)) {
        return category as MediaCategory;
      }
    }

    return null;
  }

  return {
    isMediaLibraryEnabled,
    allAcceptedMimeTypes,
    allAcceptedInputString,
    maxFileSize,
    availableCategories,
    isAcceptedMimeType,
    isAcceptedFile,
    isImageMimeType,
    getCategoryForMimeType,
  };
}
