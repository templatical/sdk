import type { UsePlanConfigReturn } from "@templatical/core/cloud";
import type { MediaCategory, MediaCategoryData } from "../types";
import { computed, inject, type ComputedRef } from "vue";

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

export function useMediaCategories(): UseMediaCategoriesReturn {
  const planConfig = inject<UsePlanConfigReturn>("planConfig")!;

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
