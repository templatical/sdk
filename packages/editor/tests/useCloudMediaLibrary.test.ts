// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { effectScope, ref } from "vue";
import { useCloudMediaLibrary } from "../src/cloud/composables/useCloudMediaLibrary";

// The built-in drag-and-drop upload lazily imports MediaApiClient from the
// optional peer; intercept that dynamic import.
const { uploadMediaMock, MediaApiClientMock } = vi.hoisted(() => {
  const uploadMediaMock = vi.fn();
  // Regular function (not arrow) so `new MediaApiClient(...)` constructs.
  const MediaApiClientMock = vi.fn(function (this: { uploadMedia: unknown }) {
    this.uploadMedia = uploadMediaMock;
  });
  return { uploadMediaMock, MediaApiClientMock };
});
vi.mock("@templatical/media-library", () => ({
  MediaApiClient: MediaApiClientMock,
}));

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

  it("settles a pending built-in promise when handleRequestMedia is called twice", async () => {
    const mediaLibraryOpen = ref(false);
    const mediaLibraryAccept = ref<string[] | undefined>(undefined);

    const { handleRequestMedia, handleMediaSelect } = useCloudMediaLibrary({
      mediaLibraryOpen,
      mediaLibraryAccept,
    } as any);

    const first = handleRequestMedia();
    const second = handleRequestMedia();

    handleMediaSelect(createMediaItem() as any);

    const firstResult = await Promise.race([
      first,
      new Promise((resolve) => setTimeout(() => resolve("hung"), 50)),
    ]);
    expect(firstResult).not.toBe("hung");

    const secondResult = await Promise.race([
      second,
      new Promise((resolve) => setTimeout(() => resolve("hung"), 50)),
    ]);
    expect(secondResult).not.toBe("hung");
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

  describe("drag-and-drop upload (#229)", () => {
    const authManager = {} as any;
    const mediaConfig = {
      use_media_library: true,
      categories: {
        images: { mime_types: ["image/png", "image/jpeg"], extensions: ["png", "jpg"] },
      },
      max_file_size: 1_000_000,
    };

    function imageFile(name = "drop.png", type = "image/png"): File {
      return new File(["data"], name, { type });
    }

    function fileOfSize(size: number, type = "image/png"): File {
      const file = new File(["data"], "big.png", { type });
      Object.defineProperty(file, "size", { value: size });
      return file;
    }

    it("uploads a dropped file (no consumer handler) and returns url/alt", async () => {
      uploadMediaMock.mockResolvedValue(
        createMediaItem({ url: "https://cdn/dropped.png", alt_text: "Dropped" }),
      );
      const { handleRequestMedia } = useCloudMediaLibrary({
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
        getMediaConfig: () => mediaConfig,
      } as any);

      const file = imageFile();
      const result = await handleRequestMedia({ accept: ["images"], files: [file] });

      expect(uploadMediaMock).toHaveBeenCalledWith(file);
      expect(result).toEqual({ url: "https://cdn/dropped.png", alt: "Dropped" });
    });

    it("forwards dropped files to a consumer handler instead of uploading", async () => {
      const item = createMediaItem({
        url: "https://cdn/by-consumer.png",
        alt_text: "By consumer",
      });
      const onRequestMedia = vi.fn().mockResolvedValue(item);
      const { handleRequestMedia } = useCloudMediaLibrary({
        onRequestMedia,
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
      } as any);

      const file = imageFile();
      const result = await handleRequestMedia({ accept: ["images"], files: [file] });

      expect(onRequestMedia).toHaveBeenCalledWith({
        accept: ["images"],
        files: [file],
      });
      expect(uploadMediaMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        url: "https://cdn/by-consumer.png",
        alt: "By consumer",
      });
    });

    it("reports an upload failure via onError and returns null", async () => {
      const err = new Error("network down");
      uploadMediaMock.mockRejectedValue(err);
      const onError = vi.fn();
      const { handleRequestMedia } = useCloudMediaLibrary({
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
        onError,
      } as any);

      const result = await handleRequestMedia({ files: [imageFile()] });

      expect(onError).toHaveBeenCalledWith(err);
      expect(result).toBe(null);
    });

    it("rejects an unsupported MIME type before uploading", async () => {
      const onError = vi.fn();
      const { handleRequestMedia } = useCloudMediaLibrary({
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
        onError,
        getMediaConfig: () => mediaConfig,
      } as any);

      const result = await handleRequestMedia({
        files: [imageFile("x.gif", "image/gif")],
      });

      expect(uploadMediaMock).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(result).toBe(null);
    });

    it("rejects an oversized file before uploading", async () => {
      const onError = vi.fn();
      const { handleRequestMedia } = useCloudMediaLibrary({
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
        onError,
        getMediaConfig: () => ({ ...mediaConfig, max_file_size: 10 }),
      } as any);

      const result = await handleRequestMedia({ files: [fileOfSize(2000)] });

      expect(uploadMediaMock).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(result).toBe(null);
    });

    it("uploads without validation when no media config is available", async () => {
      uploadMediaMock.mockResolvedValue(createMediaItem());
      const { handleRequestMedia } = useCloudMediaLibrary({
        mediaLibraryOpen: ref(false),
        mediaLibraryAccept: ref<string[] | undefined>(undefined),
        authManager,
        getMediaConfig: () => null,
      } as any);

      // A .gif that the plan config would reject still uploads — the server
      // becomes the authoritative validator when no config is loaded yet.
      const result = await handleRequestMedia({
        files: [imageFile("x.gif", "image/gif")],
      });

      expect(uploadMediaMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        url: "https://example.com/image.png",
        alt: "Test image",
      });
    });
  });
});
