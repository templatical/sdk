import { onScopeDispose, type Ref } from "vue";
import type {
  MediaCategory,
  MediaConfig,
  MediaItem,
  MediaRequestContext,
} from "@templatical/media-library";
import type { AuthManager } from "@templatical/core/cloud";
import type { MediaResult } from "@templatical/types";

export interface UseCloudMediaLibraryOptions {
  onRequestMedia?: (context: MediaRequestContext) => Promise<MediaItem | null>;
  mediaLibraryOpen: Ref<boolean>;
  mediaLibraryAccept: Ref<MediaCategory[] | undefined>;
  /** Auth used by the built-in drag-and-drop upload (#229). */
  authManager: AuthManager;
  /**
   * Active plan's media config, read at upload time for a client-side
   * pre-check (MIME + size) before hitting the network. Returns `null` until
   * the plan config has loaded; the server stays the authoritative validator.
   */
  getMediaConfig?: () => MediaConfig | null;
  /** Surface upload/validation failures to the consumer's error handler. */
  onError?: (error: Error) => void;
}

export interface UseCloudMediaLibraryReturn {
  handleRequestMedia: (
    context?: MediaRequestContext,
  ) => Promise<MediaResult | null>;
  handleMediaSelect: (item: MediaItem) => void;
  handleMediaLibraryClose: () => void;
}

export function useCloudMediaLibrary(
  options: UseCloudMediaLibraryOptions,
): UseCloudMediaLibraryReturn {
  const {
    onRequestMedia,
    mediaLibraryOpen,
    mediaLibraryAccept,
    authManager,
    getMediaConfig,
    onError,
  } = options;

  let mediaResolve: ((result: MediaResult | null) => void) | null = null;

  function toMediaResult(item: MediaItem): MediaResult {
    return { url: item.url, alt: item.alt_text || undefined };
  }

  async function handleRequestMedia(
    context?: MediaRequestContext,
  ): Promise<MediaResult | null> {
    const accept = context?.accept ?? ["images"];

    // Drag-and-drop upload path (#229). A dropped file is forwarded to a
    // consumer handler if one is configured; otherwise it's uploaded directly
    // to the cloud and the resulting media item becomes the block's image.
    if (context?.files?.length) {
      if (onRequestMedia) {
        const item = await onRequestMedia({ accept, files: context.files });
        return item ? toMediaResult(item) : null;
      }
      return uploadDroppedFile(context.files[0]);
    }

    // If consumer provides a custom media handler, use it.
    if (onRequestMedia) {
      const item = await onRequestMedia({ accept });
      return item ? toMediaResult(item) : null;
    }

    // Otherwise open the built-in media library. If a previous request
    // is still pending (e.g. consumer fired two requests back-to-back),
    // settle it with null so its caller doesn't hang forever.
    if (mediaResolve) {
      mediaResolve(null);
      mediaResolve = null;
    }
    mediaLibraryAccept.value = accept;
    mediaLibraryOpen.value = true;
    return new Promise<MediaResult | null>((resolve) => {
      mediaResolve = (result) => {
        resolve(result);
      };
    });
  }

  async function uploadDroppedFile(file: File): Promise<MediaResult | null> {
    const validationError = validateFile(file);
    if (validationError) {
      onError?.(validationError);
      return null;
    }
    try {
      // media-library is an optional, cloud-only peer — import lazily so OSS
      // bundles never pull it in. Cloud consumers always have it installed.
      const { MediaApiClient } = await import("@templatical/media-library");
      const item = await new MediaApiClient(authManager).uploadMedia(file);
      return toMediaResult(item);
    } catch (error) {
      onError?.(error as Error);
      return null;
    }
  }

  function validateFile(file: File): Error | null {
    const media = getMediaConfig?.() ?? null;
    if (!media) return null; // config not loaded yet → defer to server.
    const acceptedTypes = media.categories?.images?.mime_types ?? [];
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return new Error(
        `Unsupported image type: ${file.type || "unknown"}. Accepted: ${acceptedTypes.join(", ")}.`,
      );
    }
    if (media.max_file_size > 0 && file.size > media.max_file_size) {
      return new Error(
        `Image is too large (${file.size} bytes). Maximum allowed is ${media.max_file_size} bytes.`,
      );
    }
    return null;
  }

  function handleMediaSelect(item: MediaItem): void {
    mediaLibraryOpen.value = false;
    mediaResolve?.(toMediaResult(item));
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
