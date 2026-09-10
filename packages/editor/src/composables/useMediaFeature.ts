import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from "vue";
import type {
  MediaAsset,
  MediaCategory,
  MediaProvider,
  MediaRequestContext,
  MediaResult,
} from "@templatical/types";
import type { OnRequestMedia } from "../index";

export interface UseMediaFeatureOptions {
  /** Storage backend. Absent with a callback-only config (a host widget). */
  provider?: MediaProvider;
  /**
   * UI override. Wins over {@link provider} when both are set — the host
   * brought a widget, so the built-in modal never opens.
   */
  onRequestMedia?: OnRequestMedia;
  /**
   * Current template id, read at request time. Passed on `create` when a
   * template is loaded; omitted on a blank canvas. Media is not gated on it.
   */
  getTemplateId?: () => string | undefined;
  onError?: (error: Error) => void;
}

export interface UseMediaFeatureReturn {
  /**
   * What `useEditorCore` provides as `ON_REQUEST_MEDIA_KEY`. Null when
   * neither a provider nor a callback is configured, which is what keeps
   * image fields URL-only.
   */
  requestMedia: OnRequestMedia | null;
  /**
   * What `useEditorCore` provides as `CAN_DROP_MEDIA_KEY`. True when a
   * host callback is set (it receives `files`) or when `provider.create`
   * is a function. False for a read-only library (`create: false`) so
   * the drop zone does not highlight while Browse still works.
   */
  canDrop: ComputedRef<boolean>;
  isModalOpen: Ref<boolean>;
  accept: Ref<MediaCategory[] | undefined>;
  close: () => void;
  select: (asset: MediaAsset) => void;
  templateId: ComputedRef<string | undefined>;
  onError?: (error: Error) => void;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Client pre-check for a dropped file. Matches the modal's `isAcceptedFile`:
 * omitted `maxFileSize` / `mimeTypes` are no cap; an explicit `0` or `{}`
 * is a stated floor. `accept` narrows the mime list when the drop named
 * categories (image fields pass `["images"]`).
 *
 * Reads `maxFileSize` / `mimeTypes` off the provider at call time — Cloud
 * implements them as getters over plan config that arrives after setup.
 */
function dropFileError(
  provider: MediaProvider,
  file: File,
  accept?: MediaCategory[],
): Error | null {
  const maxFileSize = provider.maxFileSize ?? Number.POSITIVE_INFINITY;
  if (file.size > maxFileSize) {
    return new Error(
      `Image is too large (${file.size} bytes). Maximum allowed is ${maxFileSize} bytes.`,
    );
  }

  const mimeTypes = provider.mimeTypes;
  if (!mimeTypes) return null;

  const categories =
    accept && accept.length > 0
      ? accept
      : (Object.keys(mimeTypes) as MediaCategory[]);
  const allowed = categories.some(
    (category) => mimeTypes[category]?.includes(file.type) ?? false,
  );
  if (allowed) return null;

  return new Error(`Unsupported image type: ${file.type || "unknown"}.`);
}

/**
 * Synthesizes the function image fields inject as `ON_REQUEST_MEDIA_KEY`.
 *
 * `onRequestMedia` is the UI override (a host widget) and wins when both
 * are set. Otherwise a configured `media` provider opens the lazy library
 * modal, except on drop: a `create` function uploads the file without
 * opening, and `create: false` refuses the drop. Size/type after the
 * drop zone's `image/` filter is `MediaOptions`, read live on each drop.
 */
export function useMediaFeature(
  options: UseMediaFeatureOptions,
): UseMediaFeatureReturn {
  const { provider, onRequestMedia, getTemplateId, onError } = options;

  const isModalOpen = ref(false);
  const accept = ref<MediaCategory[] | undefined>(undefined);
  const templateId = computed(() => getTemplateId?.());
  // Callback present ⇒ drop goes to the host widget. Otherwise only a
  // `create` function uploads; `create: false` is a read-only library.
  const canDrop = computed(
    () => !!onRequestMedia || typeof provider?.create === "function",
  );

  let pending: ((result: MediaResult | null) => void) | null = null;

  function settle(result: MediaResult | null): void {
    isModalOpen.value = false;
    pending?.(result);
    pending = null;
  }

  function select(asset: MediaAsset): void {
    settle({ url: asset.url, alt: asset.alt });
  }

  function close(): void {
    settle(null);
  }

  onScopeDispose(() => {
    if (pending) settle(null);
  });

  const requestMedia: OnRequestMedia | null =
    onRequestMedia || provider
      ? async (context?: MediaRequestContext): Promise<MediaResult | null> => {
          if (onRequestMedia) {
            return onRequestMedia(context);
          }

          if (!provider) return null;

          if (context?.files?.length) {
            if (typeof provider.create !== "function") {
              return null;
            }
            const file = context.files[0];
            const rejected = dropFileError(provider, file, context.accept);
            if (rejected) {
              onError?.(rejected);
              return null;
            }
            const id = getTemplateId?.();
            try {
              const asset = await provider.create({
                file,
                ...(id ? { templateId: id } : {}),
              });
              try {
                provider.onCreated?.(asset);
              } catch (err) {
                onError?.(toError(err));
              }
              return { url: asset.url, alt: asset.alt };
            } catch (err) {
              onError?.(toError(err));
              return null;
            }
          }

          if (pending) {
            pending(null);
            pending = null;
          }
          accept.value = context?.accept;
          isModalOpen.value = true;
          return new Promise<MediaResult | null>((resolve) => {
            pending = resolve;
          });
        }
      : null;

  return {
    requestMedia,
    canDrop,
    isModalOpen,
    accept,
    close,
    select,
    templateId,
    onError,
  };
}
