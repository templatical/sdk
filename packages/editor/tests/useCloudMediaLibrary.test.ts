import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { effectScope, ref } from "vue";
import { useCloudMediaLibrary } from "../src/cloud/composables/useCloudMediaLibrary";

function createMediaItem(overrides: Record<string, any> = {}) {
  return {
    id: "media-1",
    url: "https://example.com/image.png",
    alt_text: "Test image",
    name: "image.png",
    mime_type: "image/png",
    size: 1024,
    width: 800,
    height: 600,
    ...overrides,
  };
}

describe("useCloudMediaLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleRequestMedia with custom onRequestMedia calls it", async () => {
    const item = createMediaItem();
    const onRequestMedia = vi.fn().mockResolvedValue(item);
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const { handleRequestMedia } = useCloudMediaLibrary({
      onRequestMedia,
      mediaLibraryOpen,
      mediaLibraryAccept,
    } as any);

    const result = await handleRequestMedia();

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    expect(result).toEqual({
      url: "https://example.com/image.png",
      alt: "Test image",
    });
    expect(mediaLibraryOpen.value).toBe(false);
  });

  it("handleRequestMedia with custom handler returning null returns null", async () => {
    const onRequestMedia = vi.fn().mockResolvedValue(null);
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const { handleRequestMedia } = useCloudMediaLibrary({
      onRequestMedia,
      mediaLibraryOpen,
      mediaLibraryAccept,
    } as any);

    const result = await handleRequestMedia();

    expect(result).toBe(null);
  });

  it("handleRequestMedia without custom handler opens mediaLibraryOpen", async () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    // Start the request (it will wait for resolution)
    const promise = composable!.handleRequestMedia();

    expect(mediaLibraryOpen.value).toBe(true);
    expect(mediaLibraryAccept.value).toEqual(["images"]);

    // Resolve by selecting media
    const item = createMediaItem({
      url: "https://example.com/photo.jpg",
      alt_text: "Photo",
    });
    composable!.handleMediaSelect(item);

    const result = await promise;
    expect(result).toEqual({
      url: "https://example.com/photo.jpg",
      alt: "Photo",
    });
    expect(mediaLibraryOpen.value).toBe(false);

    scope.stop();
  });

  it("handleMediaSelect resolves the promise with url/alt", async () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    const promise = composable!.handleRequestMedia();

    const item = createMediaItem({ alt_text: "" });
    composable!.handleMediaSelect(item);

    const result = await promise;
    expect(result).toEqual({
      url: "https://example.com/image.png",
      alt: undefined,
    });

    scope.stop();
  });

  it("handleMediaLibraryClose resolves with null", async () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    const promise = composable!.handleRequestMedia();

    expect(mediaLibraryOpen.value).toBe(true);

    composable!.handleMediaLibraryClose();

    const result = await promise;
    expect(result).toBe(null);
    expect(mediaLibraryOpen.value).toBe(false);

    scope.stop();
  });

  it("onScopeDispose resolves pending promise with null", async () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    const promise = composable!.handleRequestMedia();

    expect(mediaLibraryOpen.value).toBe(true);

    // Stopping the scope triggers onScopeDispose
    scope.stop();

    const result = await promise;
    expect(result).toBe(null);
  });

  it("handleMediaSelect without pending promise is safe (no-op)", () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    // Should not throw
    composable!.handleMediaSelect(createMediaItem());
    expect(mediaLibraryOpen.value).toBe(false);

    scope.stop();
  });

  it("handleMediaLibraryClose without pending promise is safe (no-op)", () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const scope = effectScope();
    let composable: ReturnType<typeof useCloudMediaLibrary>;

    scope.run(() => {
      composable = useCloudMediaLibrary({
        mediaLibraryOpen,
        mediaLibraryAccept,
      } as any);
    });

    // Should not throw
    composable!.handleMediaLibraryClose();
    expect(mediaLibraryOpen.value).toBe(false);

    scope.stop();
  });

  it("custom handler item with alt_text maps to alt field", async () => {
    const item = createMediaItem({
      url: "https://cdn.test/pic.webp",
      alt_text: "A beautiful sunset",
    });
    const onRequestMedia = vi.fn().mockResolvedValue(item);
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const { handleRequestMedia } = useCloudMediaLibrary({
      onRequestMedia,
      mediaLibraryOpen,
      mediaLibraryAccept,
    } as any);

    const result = await handleRequestMedia();

    expect(result).toEqual({
      url: "https://cdn.test/pic.webp",
      alt: "A beautiful sunset",
    });
  });
});
