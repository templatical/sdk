// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";
import { useMediaCategories } from "../src/composables/useMediaCategories";
import { MEDIA_LIMITS_KEY, type MediaLimits } from "../src/keys";
import type { MediaCategory } from "../src/types";

/**
 * Provides under `MEDIA_LIMITS_KEY`, not the string `"mediaLimits"`. The
 * string form never resolves the `Symbol` a host provided — Vue matches
 * injection keys by identity.
 */
function withProvide<T>(
  setup: () => T,
  provides: { limits?: MediaLimits } = {},
): T {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  if (provides.limits !== undefined) {
    app.provide(MEDIA_LIMITS_KEY, provides.limits);
  }
  app.mount(document.createElement("div"));
  app.unmount();
  return result!;
}

/**
 * Keep the app mounted: a getter-backed field filling after setup needs a
 * live computed, and unmounting would freeze it.
 */
function withLive<T>(
  setup: () => T,
  limits: MediaLimits,
): { result: T; unmount: () => void } {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  app.provide(MEDIA_LIMITS_KEY, limits);
  app.mount(document.createElement("div"));
  return { result: result!, unmount: () => app.unmount() };
}

const sampleMimeTypes: NonNullable<MediaLimits["mimeTypes"]> = {
  images: ["image/jpeg", "image/png", "image/gif"],
  documents: ["application/pdf"],
  videos: ["video/mp4"],
};

const sampleLimits: MediaLimits = {
  maxFileSize: 10485760,
  mimeTypes: sampleMimeTypes,
};

describe("useMediaCategories", () => {
  /**
   * Cloud exposes `maxFileSize` as a getter over plan config that arrives
   * after construction. Reading it once at setup pins the client pre-check
   * to `undefined`/`0` for the whole session — the `allowedRecipients`
   * lesson. This case is the proof: a snapshot at setup stays `0` after
   * `backing` fills, so the second expect fails.
   */
  it("tracks a getter-backed maxFileSize that fills after setup", () => {
    const backing = ref<number | undefined>(undefined);
    const limits: MediaLimits = {
      get maxFileSize() {
        return backing.value;
      },
    };

    const { result, unmount } = withLive(() => useMediaCategories(), limits);

    expect(result.maxFileSize.value).toBe(0);

    backing.value = 1_048_576;

    expect(result.maxFileSize.value).toBe(1_048_576);

    unmount();
  });

  it("tracks a getter-backed maxFileSize passed as the override", () => {
    const backing = ref<number | undefined>(undefined);
    const limits: MediaLimits = {
      get maxFileSize() {
        return backing.value;
      },
    };

    let maxFileSize: { value: number };
    const app = createApp(
      defineComponent({
        setup() {
          maxFileSize = useMediaCategories(limits).maxFileSize;
          return () => h("div");
        },
      }),
    );
    app.mount(document.createElement("div"));

    expect(maxFileSize!.value).toBe(0);

    backing.value = 1_048_576;

    expect(maxFileSize!.value).toBe(1_048_576);

    app.unmount();
  });

  it("tracks a getter-backed mimeTypes that fills after setup", () => {
    const backing = ref<MediaLimits["mimeTypes"]>(undefined);
    const limits: MediaLimits = {
      get mimeTypes() {
        return backing.value;
      },
    };

    const { result, unmount } = withLive(() => useMediaCategories(), limits);

    expect(result.allAcceptedMimeTypes.value).toEqual([]);
    expect(result.availableCategories.value).toEqual([
      "images",
      "documents",
      "videos",
      "audio",
    ]);

    backing.value = { images: ["image/png"] };

    expect(result.allAcceptedMimeTypes.value).toEqual(["image/png"]);
    expect(result.availableCategories.value).toEqual(["images"]);

    unmount();
  });

  describe("isMediaLibraryEnabled", () => {
    it("is true whenever limits are in scope", () => {
      const { isMediaLibraryEnabled } = withProvide(
        () => useMediaCategories(),
        {
          limits: {},
        },
      );
      expect(isMediaLibraryEnabled.value).toBe(true);
    });

    it("is true when mimeTypes and maxFileSize are set", () => {
      const { isMediaLibraryEnabled } = withProvide(
        () => useMediaCategories(),
        {
          limits: sampleLimits,
        },
      );
      expect(isMediaLibraryEnabled.value).toBe(true);
    });
  });

  describe("allAcceptedMimeTypes", () => {
    it("flattens all category mime types", () => {
      const { allAcceptedMimeTypes } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(allAcceptedMimeTypes.value).toEqual([
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "video/mp4",
      ]);
    });

    it("narrows to accept when the host set a filter", () => {
      const { allAcceptedMimeTypes } = withProvide(() => useMediaCategories(), {
        limits: { ...sampleLimits, accept: ["images"] },
      });
      expect(allAcceptedMimeTypes.value).toEqual([
        "image/jpeg",
        "image/png",
        "image/gif",
      ]);
    });
  });

  describe("allAcceptedInputString", () => {
    it("joins with commas", () => {
      const { allAcceptedInputString } = withProvide(
        () => useMediaCategories(),
        {
          limits: sampleLimits,
        },
      );
      expect(allAcceptedInputString.value).toBe(
        "image/jpeg,image/png,image/gif,application/pdf,video/mp4",
      );
    });
  });

  describe("maxFileSize", () => {
    it("defaults to 0", () => {
      const { maxFileSize } = withProvide(() => useMediaCategories(), {
        limits: {},
      });
      expect(maxFileSize.value).toBe(0);
    });

    it("reads from limits", () => {
      const { maxFileSize } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(maxFileSize.value).toBe(10485760);
    });

    it("returns the configured value", () => {
      const { maxFileSize } = withProvide(() => useMediaCategories(), {
        limits: { maxFileSize: 5242880 },
      });
      expect(maxFileSize.value).toBe(5242880);
    });
  });

  describe("availableCategories", () => {
    it("returns mimeTypes keys", () => {
      const { availableCategories } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(availableCategories.value).toEqual([
        "images",
        "documents",
        "videos",
      ]);
    });

    it("is all four when mimeTypes is omitted", () => {
      const { availableCategories } = withProvide(() => useMediaCategories(), {
        limits: {},
      });
      expect(availableCategories.value).toEqual([
        "images",
        "documents",
        "videos",
        "audio",
      ]);
    });

    it("uses the accept filter when the host set one", () => {
      const { availableCategories } = withProvide(() => useMediaCategories(), {
        limits: { ...sampleLimits, accept: ["images"] },
      });
      expect(availableCategories.value).toEqual(["images"]);
    });
  });

  describe("isAcceptedMimeType", () => {
    it("returns true for valid type", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isAcceptedMimeType("image/jpeg")).toBe(true);
      expect(isAcceptedMimeType("application/pdf")).toBe(true);
    });

    it("returns false for invalid type", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isAcceptedMimeType("text/plain")).toBe(false);
    });

    it("with accept checks only specified categories", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isAcceptedMimeType("image/jpeg", ["images"])).toBe(true);
      expect(isAcceptedMimeType("application/pdf", ["images"])).toBe(false);
      expect(isAcceptedMimeType("application/pdf", ["documents"])).toBe(true);
    });

    it("returns true when mimeTypes is omitted — no client pre-check", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: {},
      });
      expect(isAcceptedMimeType("image/jpeg")).toBe(true);
      expect(isAcceptedMimeType("text/plain")).toBe(true);
    });

    it("with empty accept checks all configured types", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isAcceptedMimeType("image/jpeg", [])).toBe(true);
      expect(isAcceptedMimeType("text/plain", [])).toBe(false);
    });

    it("with a category that has no mime list returns false", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isAcceptedMimeType("image/jpeg", ["audio" as MediaCategory])).toBe(
        false,
      );
    });
  });

  describe("isImageMimeType", () => {
    it("checks images category only", () => {
      const { isImageMimeType } = withProvide(() => useMediaCategories(), {
        limits: sampleLimits,
      });
      expect(isImageMimeType("image/jpeg")).toBe(true);
      expect(isImageMimeType("image/png")).toBe(true);
      expect(isImageMimeType("application/pdf")).toBe(false);
      expect(isImageMimeType("video/mp4")).toBe(false);
    });

    it("falls back to the image/ prefix when mimeTypes is omitted", () => {
      const { isImageMimeType } = withProvide(() => useMediaCategories(), {
        limits: {},
      });
      expect(isImageMimeType("image/jpeg")).toBe(true);
      expect(isImageMimeType("application/pdf")).toBe(false);
    });
  });

  describe("getCategoryForMimeType", () => {
    it("returns matching category", () => {
      const { getCategoryForMimeType } = withProvide(
        () => useMediaCategories(),
        {
          limits: sampleLimits,
        },
      );
      expect(getCategoryForMimeType("image/jpeg")).toBe("images");
      expect(getCategoryForMimeType("application/pdf")).toBe("documents");
      expect(getCategoryForMimeType("video/mp4")).toBe("videos");
    });

    it("returns null for unmatched", () => {
      const { getCategoryForMimeType } = withProvide(
        () => useMediaCategories(),
        {
          limits: sampleLimits,
        },
      );
      expect(getCategoryForMimeType("text/plain")).toBeNull();
    });

    it("returns null when mimeTypes is omitted", () => {
      const { getCategoryForMimeType } = withProvide(
        () => useMediaCategories(),
        {
          limits: {},
        },
      );
      expect(getCategoryForMimeType("image/jpeg")).toBeNull();
    });
  });

  describe("with empty mimeTypes", () => {
    it("allAcceptedMimeTypes returns empty array", () => {
      const { allAcceptedMimeTypes } = withProvide(() => useMediaCategories(), {
        limits: { mimeTypes: {} },
      });
      expect(allAcceptedMimeTypes.value).toEqual([]);
    });

    it("allAcceptedInputString returns empty string", () => {
      const { allAcceptedInputString } = withProvide(
        () => useMediaCategories(),
        {
          limits: { mimeTypes: {} },
        },
      );
      expect(allAcceptedInputString.value).toBe("");
    });

    it("availableCategories returns empty array", () => {
      const { availableCategories } = withProvide(() => useMediaCategories(), {
        limits: { mimeTypes: {} },
      });
      expect(availableCategories.value).toEqual([]);
    });

    it("isAcceptedMimeType returns false", () => {
      const { isAcceptedMimeType } = withProvide(() => useMediaCategories(), {
        limits: { mimeTypes: {} },
      });
      expect(isAcceptedMimeType("image/jpeg")).toBe(false);
    });

    it("isImageMimeType returns false", () => {
      const { isImageMimeType } = withProvide(() => useMediaCategories(), {
        limits: { mimeTypes: {} },
      });
      expect(isImageMimeType("image/jpeg")).toBe(false);
    });
  });

  describe("override argument", () => {
    it("reads limits passed as the argument rather than inject", () => {
      const { maxFileSize } = withProvide(() =>
        useMediaCategories({ maxFileSize: 4242 }),
      );
      expect(maxFileSize.value).toBe(4242);
    });
  });
});
