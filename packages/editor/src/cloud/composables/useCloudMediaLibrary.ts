import { onScopeDispose, type Ref } from "vue";
import type {
  MediaCategory,
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";
import type { MediaResult } from "@templatical/types";

export interface UseCloudMediaLibraryOptions {
  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  mediaLibraryOpen: Ref<boolean>;
  mediaLibraryAccept: Ref<MediaCategory[] | undefined>;
}

export interface UseCloudMediaLibraryReturn {
  handleRequestMedia: () => Promise<MediaResult | null>;
  handleMediaSelect: (item: MediaItem) => void;
  handleMediaLibraryClose: () => void;
}

export function useCloudMediaLibrary(
  options: UseCloudMediaLibraryOptions,
): UseCloudMediaLibraryReturn {
  const { onRequestMedia, mediaLibraryOpen, mediaLibraryAccept } = options;

  let mediaResolve: ((result: MediaResult | null) => void) | null = null;

  async function handleRequestMedia(): Promise<MediaResult | null> {
    // If consumer provides a custom media handler, use it
    if (onRequestMedia) {
      const item = await onRequestMedia({ accept: ["images"] });
      if (!item) return null;
      return { url: item.url, alt: item.alt_text || undefined };
    }

    // Otherwise open the built-in media library
    mediaLibraryAccept.value = ["images"];
    mediaLibraryOpen.value = true;
    return new Promise<MediaResult | null>((resolve) => {
      mediaResolve = (result) => {
        resolve(result);
      };
    });
  }

  function handleMediaSelect(item: MediaItem): void {
    mediaLibraryOpen.value = false;
    mediaResolve?.({ url: item.url, alt: item.alt_text || undefined });
    mediaResolve = null;
  }

  function handleMediaLibraryClose(): void {
    mediaLibraryOpen.value = false;
    mediaResolve?.(null);
    mediaResolve = null;
  }

  onScopeDispose(() => {
    if (mediaResolve) {
      mediaResolve(null);
      mediaResolve = null;
    }
  });

  return {
    handleRequestMedia,
    handleMediaSelect,
    handleMediaLibraryClose,
  };
}
