// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, shallowMount, flushPromises } from "@vue/test-utils";
import { ref, toValue, type MaybeRefOrGetter } from "vue";
import { SYNTAX_PRESETS, createImageBlock } from "@templatical/types";
import type { CustomBlockImageField } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";

// Mock the drop composable so we can drive its onFiles callback directly and
// assert the component's upload wiring (the composable itself is covered by
// useImageDrop.test.ts).
vi.mock("../src/composables/useImageDrop", () => ({
  useImageDrop: vi.fn(() => ({ isOver: ref(false) })),
}));
import { useImageDrop } from "../src/composables/useImageDrop";

import ImageBlock from "../src/components/blocks/ImageBlock.vue";
import ImageField from "../src/components/toolbar/fields/ImageField.vue";
import ImageToolbar from "../src/components/toolbar/ImageToolbar.vue";

function provideMap(onRequestMedia: unknown) {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: [],
    [ON_REQUEST_MEDIA_KEY as symbol]: onRequestMedia,
  };
}

function lastDropOptions() {
  const calls = vi.mocked(useImageDrop).mock.calls;
  return calls[calls.length - 1][0];
}

function dropImage(): File {
  const file = new File(["data"], "up.png", { type: "image/png" });
  lastDropOptions().onFiles([file]);
  return file;
}

beforeEach(() => {
  vi.mocked(useImageDrop).mockClear();
});

describe("ImageBlock drag-and-drop upload (#229)", () => {
  it("uploads a dropped file via onRequestMedia and emits update with src + alt", async () => {
    const onRequestMedia = vi
      .fn()
      .mockResolvedValue({ url: "https://cdn/up.png", alt: "Uploaded" });
    const wrapper = mount(ImageBlock, {
      props: { block: createImageBlock({ src: "" }), viewport: "desktop" },
      global: { provide: provideMap(onRequestMedia) },
    });

    const file = dropImage();
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ["images"],
      files: [file],
    });
    expect(wrapper.emitted("update")?.[0]).toEqual([
      { src: "https://cdn/up.png", alt: "Uploaded" },
    ]);
  });

  it("omits alt when the upload result has none", async () => {
    const onRequestMedia = vi
      .fn()
      .mockResolvedValue({ url: "https://cdn/up.png" });
    const wrapper = mount(ImageBlock, {
      props: {
        block: createImageBlock({ src: "https://cdn/old.png" }),
        viewport: "desktop",
      },
      global: { provide: provideMap(onRequestMedia) },
    });

    dropImage();
    await flushPromises();

    expect(wrapper.emitted("update")?.[0]).toEqual([
      { src: "https://cdn/up.png" },
    ]);
  });

  it("does nothing when no media handler is provided", async () => {
    const wrapper = mount(ImageBlock, {
      props: { block: createImageBlock({ src: "" }), viewport: "desktop" },
      global: { provide: provideMap(null) },
    });

    dropImage();
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("disables the drop zone for a merge-tag src (never clobbers it)", () => {
    mount(ImageBlock, {
      props: {
        block: createImageBlock({ src: "{{ user.avatar }}" }),
        viewport: "desktop",
      },
      global: { provide: provideMap(vi.fn()) },
    });

    expect(
      toValue(lastDropOptions().enabled as MaybeRefOrGetter<boolean>),
    ).toBe(false);
  });
});

describe("ImageField drag-and-drop upload (#229)", () => {
  const field: CustomBlockImageField = {
    type: "image",
    key: "img",
    label: "Image",
  };

  it("uploads a dropped file and emits update:modelValue with the url", async () => {
    const onRequestMedia = vi
      .fn()
      .mockResolvedValue({ url: "https://cdn/f.png", alt: "ignored" });
    const wrapper = shallowMount(ImageField, {
      props: { field, modelValue: "" },
      global: { provide: provideMap(onRequestMedia) },
    });

    const file = dropImage();
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ["images"],
      files: [file],
    });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([
      "https://cdn/f.png",
    ]);
  });

  it("disables the drop zone in readOnly mode", () => {
    shallowMount(ImageField, {
      props: { field, modelValue: "", readOnly: true },
      global: { provide: provideMap(vi.fn()) },
    });

    expect(
      toValue(lastDropOptions().enabled as MaybeRefOrGetter<boolean>),
    ).toBe(false);
  });
});

describe("ImageToolbar drag-and-drop upload (#229)", () => {
  it("uploads a dropped file and updates src + alt", async () => {
    const onRequestMedia = vi
      .fn()
      .mockResolvedValue({ url: "https://cdn/t.png", alt: "Alt" });
    const wrapper = shallowMount(ImageToolbar, {
      props: { block: createImageBlock({ src: "" }) },
      global: { provide: provideMap(onRequestMedia) },
    });

    const file = dropImage();
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ["images"],
      files: [file],
    });
    // updateField emits one `update` per field (src, then alt).
    const payloads = (wrapper.emitted("update") ?? []).map((c) => c[0]);
    expect(payloads).toContainEqual({ src: "https://cdn/t.png" });
    expect(payloads).toContainEqual({ alt: "Alt" });
  });

  it("does nothing when no media handler is provided", async () => {
    const wrapper = shallowMount(ImageToolbar, {
      props: { block: createImageBlock({ src: "" }) },
      global: { provide: provideMap(null) },
    });

    dropImage();
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
  });
});
