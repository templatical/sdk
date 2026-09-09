// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import type {
  MediaAsset,
  MediaProvider,
  MediaRequestContext,
  MediaResult,
} from "@templatical/types";
import {
  useMediaFeature,
  type UseMediaFeatureReturn,
} from "../src/composables/useMediaFeature";

function createMockProvider(
  overrides: Partial<MediaProvider> = {},
): MediaProvider {
  return {
    list: vi.fn().mockResolvedValue({ items: [] }),
    create: false,
    update: false,
    delete: false,
    folders: false,
    replace: false,
    importFromUrl: false,
    checkUsage: false,
    frequentlyUsed: false,
    storage: false,
    ...overrides,
  };
}

const ASSET: MediaAsset = {
  id: "a1",
  url: "https://cdn.example.com/hero.png",
  alt: "Hero",
};

function withFeature(
  options: {
    provider?: MediaProvider;
    onRequestMedia?: (
      context?: MediaRequestContext,
    ) => Promise<MediaResult | null>;
    getTemplateId?: () => string | undefined;
    onError?: (error: Error) => void;
  } = {},
) {
  let feature!: UseMediaFeatureReturn;

  const wrapper = mount(
    defineComponent({
      setup() {
        feature = useMediaFeature({
          provider: options.provider,
          onRequestMedia: options.onRequestMedia,
          getTemplateId: options.getTemplateId,
          onError: options.onError,
        });
        return () => h("div");
      },
    }),
  );

  return { feature, wrapper };
}

describe("useMediaFeature", () => {
  it("is null when neither a provider nor a callback is given", () => {
    const { feature } = withFeature();

    expect(feature.requestMedia).toBe(null);
  });

  it("calls the callback and keeps the modal closed when only a callback is given", async () => {
    const onRequestMedia = vi.fn().mockResolvedValue({
      url: "https://widget.example.com/picked.png",
    });
    const { feature } = withFeature({ onRequestMedia });

    const result = await feature.requestMedia!({ accept: ["images"] });

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    expect(feature.isModalOpen.value).toBe(false);
    expect(result).toEqual({ url: "https://widget.example.com/picked.png" });
  });

  it("opens the modal for a provider and resolves the picked asset", async () => {
    const { feature } = withFeature({ provider: createMockProvider() });

    const promise = feature.requestMedia!();
    expect(feature.isModalOpen.value).toBe(true);

    feature.select(ASSET);
    await expect(promise).resolves.toEqual({
      url: "https://cdn.example.com/hero.png",
      alt: "Hero",
    });
    expect(feature.isModalOpen.value).toBe(false);
  });

  it("refuses a drop when the provider's create is false", async () => {
    const provider = createMockProvider({ create: false });
    const { feature } = withFeature({ provider });
    const file = new File(["x"], "photo.png", { type: "image/png" });

    const result = await feature.requestMedia!({ files: [file] });

    expect(result).toBe(null);
    expect(feature.isModalOpen.value).toBe(false);
  });

  it("uploads a drop through create and does not open the modal", async () => {
    const create = vi.fn().mockResolvedValue(ASSET);
    const onCreated = vi.fn();
    const provider = createMockProvider({ create, onCreated });
    const { feature } = withFeature({
      provider,
      getTemplateId: () => "tpl-1",
    });
    const file = new File(["x"], "photo.png", { type: "image/png" });

    const result = await feature.requestMedia!({ files: [file] });

    expect(create).toHaveBeenCalledWith({ file, templateId: "tpl-1" });
    expect(onCreated).toHaveBeenCalledWith(ASSET);
    expect(feature.isModalOpen.value).toBe(false);
    expect(result).toEqual({
      url: "https://cdn.example.com/hero.png",
      alt: "Hero",
    });
  });

  it("does not call create when the dropped file exceeds maxFileSize", async () => {
    const create = vi.fn().mockResolvedValue(ASSET);
    const onError = vi.fn();
    const provider = createMockProvider({ create, maxFileSize: 512 });
    const { feature } = withFeature({ provider, onError });
    const file = new File([new Uint8Array(1024)], "photo.png", {
      type: "image/png",
    });

    const result = await feature.requestMedia!({ files: [file] });

    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(null);
    expect(feature.isModalOpen.value).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toContain("1024");
    expect(onError.mock.calls[0][0].message).toContain("512");
  });

  it("observes a getter-backed maxFileSize that fills after setup", async () => {
    // Cloud exposes maxFileSize as a getter over plan config that arrives
    // after construction. A snapshot at setup would pin the pre-check to
    // "no cap" and let an oversize drop through once the getter fills.
    const backing: { maxFileSize?: number } = {};
    const create = vi.fn().mockResolvedValue(ASSET);
    const provider: MediaProvider = {
      ...createMockProvider({ create }),
      get maxFileSize() {
        return backing.maxFileSize;
      },
    };
    const { feature } = withFeature({ provider });
    const file = new File([new Uint8Array(1024)], "photo.png", {
      type: "image/png",
    });

    await feature.requestMedia!({ files: [file] });
    expect(create).toHaveBeenCalledTimes(1);

    create.mockClear();
    backing.maxFileSize = 512;
    const result = await feature.requestMedia!({ files: [file] });
    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(null);
  });

  it("does not call create when the dropped file's type is not in mimeTypes", async () => {
    const create = vi.fn().mockResolvedValue(ASSET);
    const provider = createMockProvider({
      create,
      mimeTypes: { images: ["image/png"] },
    });
    const { feature } = withFeature({ provider });
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

    const result = await feature.requestMedia!({ files: [file] });

    expect(create).not.toHaveBeenCalled();
    expect(result).toBe(null);
    expect(feature.isModalOpen.value).toBe(false);
  });

  it("settles a pending request with null when a second one starts", async () => {
    const { feature } = withFeature({ provider: createMockProvider() });

    const first = feature.requestMedia!();
    const second = feature.requestMedia!();

    await expect(first).resolves.toBe(null);
    expect(feature.isModalOpen.value).toBe(true);

    feature.select(ASSET);
    await expect(second).resolves.toEqual({
      url: "https://cdn.example.com/hero.png",
      alt: "Hero",
    });
  });

  it("lets the callback win over a provider, without calling list", async () => {
    const provider = createMockProvider();
    const onRequestMedia = vi.fn().mockResolvedValue({
      url: "https://widget.example.com/picked.png",
    });
    const { feature } = withFeature({ provider, onRequestMedia });

    const result = await feature.requestMedia!({ accept: ["images"] });

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    expect(provider.list).not.toHaveBeenCalled();
    expect(feature.isModalOpen.value).toBe(false);
    expect(result).toEqual({ url: "https://widget.example.com/picked.png" });
  });
});
