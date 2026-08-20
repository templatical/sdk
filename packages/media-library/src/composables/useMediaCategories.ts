import type { MediaCategory, MediaCategoryData } from "../types";
import { computed, inject, type ComputedRef } from "vue";
import { PLAN_CONFIG_KEY } from "../keys";
import type { UsePlanConfigReturn } from "@templatical/core/cloud";

export type { MediaCategory };

export interface UseMediaCategoriesReturn {
  isMediaLibraryEnabled: ComputedRef<boolean>;
  allAcceptedMimeTypes: ComputedRef<string[]>;
  allAcceptedInputString: ComputedRef<string>;
  maxFileSize: ComputedRef<number>;
  availableCategories: ComputedRef<MediaCategory[]>;
  isAcceptedMimeType: (
    mimeType: string,
    filterCategories?: MediaCategory[],
  ) => boolean;
  isImageMimeType: (mimeType: string) => boolean;
  getCategoryForMimeType: (mimeType: string) => MediaCategory | null;
}

export function useMediaCategories(
  /**
   * The plan config to read, for callers that cannot inject one.
   *
   * A component never sees its own `provide` — Vue resolves `inject` against
   * the *parent* chain — so the two hosts that provide `PLAN_CONFIG_KEY`
   * cannot also inject it, and must pass their value here instead. Descendants
   * (`MediaGrid`, `MediaEditModal`, `MediaUploadZone`, `MediaPreviewPanel`)
   * omit the argument and inject as before. Mirrors `useI18n(override?)`.
   */
  planConfigOverride?: UsePlanConfigReturn,
): UseMediaCategoriesReturn {
  // Explicit null default + throw rather than a `!` assertion: without a
  // provider every read below became `undefined.config`, which is a TypeError
  // several frames away from the missing wiring. Reaching this message means a
  // descendant was rendered outside both hosts, or a host forgot the argument
  // above.
  const planConfig = planConfigOverride ?? inject(PLAN_CONFIG_KEY, null);
  if (!planConfig) {
    throw new Error(
      "[Templatical] useMediaCategories() needs a plan config in scope. Render it under <MediaLibraryModal> (pass its `planConfig` prop) or provide PLAN_CONFIG_KEY yourself.",
    );
  }

  const mediaConfig = computed(() => planConfig.config.value?.media ?? null);

  const isMediaLibraryEnabled = computed(
    () => mediaConfig.value?.use_media_library ?? true,
  );

  const categories = computed(
    () =>
      (mediaConfig.value?.categories as Record<
        MediaCategory,
        MediaCategoryData
      > | null) ?? null,
  );

  const allAcceptedMimeTypes = computed(() => {
    if (!categories.value) {
      return [];
    }

    return Object.values(categories.value).flatMap((c) => c.mime_types);
  });

  const allAcceptedInputString = computed(() =>
    allAcceptedMimeTypes.value.join(","),
  );

  const maxFileSize = computed(() => mediaConfig.value?.max_file_size ?? 0);

  function isAcceptedMimeType(
    mimeType: string,
    filterCategories?: MediaCategory[],
  ): boolean {
    if (!categories.value) {
      return false;
    }

    if (!filterCategories || filterCategories.length === 0) {
      return allAcceptedMimeTypes.value.includes(mimeType);
    }

    return filterCategories.some((category) =>
      categories.value![category]?.mime_types.includes(mimeType),
    );
  }

  function isImageMimeType(mimeType: string): boolean {
    if (!categories.value) {
      return false;
    }

    return categories.value.images?.mime_types.includes(mimeType) ?? false;
  }

  function getCategoryForMimeType(mimeType: string): MediaCategory | null {
    if (!categories.value) {
      return null;
    }

    for (const [category, data] of Object.entries(categories.value)) {
      if (data.mime_types.includes(mimeType)) {
        return category as MediaCategory;
      }
    }

    return null;
  }

  const availableCategories = computed((): MediaCategory[] => {
    if (!categories.value) {
      return [];
    }

    return Object.keys(categories.value) as MediaCategory[];
  });

  return {
    isMediaLibraryEnabled,
    allAcceptedMimeTypes,
    allAcceptedInputString,
    maxFileSize,
    availableCategories,
    isAcceptedMimeType,
    isImageMimeType,
    getCategoryForMimeType,
  };
}
