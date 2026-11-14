// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mount,
  shallowMount,
  flushPromises,
  type VueWrapper,
} from "@vue/test-utils";
import {
  shallowRef,
  computed,
  nextTick,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import {
  SYNTAX_PRESETS,
  createBackgroundImage,
  createImageBlock,
} from "@templatical/types";
import type {
  CustomBlockImageField,
  CustomSocialIcon,
  MediaResult,
} from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  CAN_DROP_MEDIA_KEY,
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
import BackgroundImageControl from "../src/components/toolbar/BackgroundImageControl.vue";
import SocialCustomIconFields from "../src/components/toolbar/SocialCustomIconFields.vue";

function provideMap(onRequestMedia: unknown, canDrop?: boolean) {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: shallowRef([]),
    [ON_REQUEST_MEDIA_KEY as symbol]: onRequestMedia,
    ...(canDrop !== undefined
      ? { [CAN_DROP_MEDIA_KEY as symbol]: computed(() => canDrop) }
      : {}),
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

  it("disables the drop zone for a read-only library while Browse stays", () => {
    const wrapper = mount(ImageBlock, {
      props: { block: createImageBlock({ src: "" }), viewport: "desktop" },
      global: { provide: provideMap(vi.fn(), false) },
    });

    expect(
      toValue(lastDropOptions().enabled as MaybeRefOrGetter<boolean>),
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="image-drop-zone"]')
        .attributes("data-drop-enabled"),
    ).toBe("false");
    const browse = wrapper
      .findAll("button")
      .find((b) => b.text().includes(enTranslations.image.browseMedia));
    expect(browse).toBeTruthy();
    expect(browse!.text()).toContain(enTranslations.image.browseMedia);
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

  it("disables the drop zone for a read-only library", () => {
    shallowMount(ImageField, {
      props: { field, modelValue: "" },
      global: { provide: provideMap(vi.fn(), false) },
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

  it("disables the drop zone for a read-only library", () => {
    shallowMount(ImageToolbar, {
      props: { block: createImageBlock({ src: "" }) },
      global: { provide: provideMap(vi.fn(), false) },
    });

    expect(
      toValue(lastDropOptions().enabled as MaybeRefOrGetter<boolean>),
    ).toBe(false);
  });
});

describe("a drop upload never overwrites a URL changed while it ran", () => {
  const OLD = "https://cdn/old.png";
  const TYPED = "https://typed.example/new.png";
  const UPLOADED = "https://cdn/up.png";
  const field: CustomBlockImageField = {
    type: "image",
    key: "img",
    label: "Image",
  };
  const icon = (imageUrl: string): CustomSocialIcon => ({
    id: "i1",
    platform: "custom",
    url: "https://example.com",
    imageUrl,
  });

  // Each caller passes its own `value` getter to useMediaDropField; a wrong
  // one (a constant, another field) lets the stale upload through.
  const callers: Array<{
    name: string;
    mount: (onRequestMedia: unknown) => VueWrapper;
    retype: (wrapper: VueWrapper) => Promise<void>;
  }> = [
    {
      name: "ImageBlock",
      mount: (onRequestMedia) =>
        mount(ImageBlock, {
          props: { block: createImageBlock({ src: OLD }), viewport: "desktop" },
          global: { provide: provideMap(onRequestMedia) },
        }) as VueWrapper,
      retype: (w) => w.setProps({ block: createImageBlock({ src: TYPED }) }),
    },
    {
      name: "ImageToolbar",
      mount: (onRequestMedia) =>
        shallowMount(ImageToolbar, {
          props: { block: createImageBlock({ src: OLD }) },
          global: { provide: provideMap(onRequestMedia) },
        }) as VueWrapper,
      retype: (w) => w.setProps({ block: createImageBlock({ src: TYPED }) }),
    },
    {
      name: "ImageField",
      mount: (onRequestMedia) =>
        shallowMount(ImageField, {
          props: { field, modelValue: OLD },
          global: { provide: provideMap(onRequestMedia) },
        }) as VueWrapper,
      retype: (w) => w.setProps({ modelValue: TYPED }),
    },
    {
      name: "BackgroundImageControl",
      mount: (onRequestMedia) =>
        shallowMount(BackgroundImageControl, {
          props: {
            modelValue: createBackgroundImage(OLD),
            testidPrefix: "bg",
          },
          global: { provide: provideMap(onRequestMedia) },
        }) as VueWrapper,
      retype: (w) => w.setProps({ modelValue: createBackgroundImage(TYPED) }),
    },
    {
      name: "SocialCustomIconFields",
      mount: (onRequestMedia) =>
        shallowMount(SocialCustomIconFields, {
          props: { icon: icon(OLD) },
          global: { provide: provideMap(onRequestMedia) },
        }) as VueWrapper,
      retype: (w) => w.setProps({ icon: icon(TYPED) }),
    },
  ];

  function deferredUpload() {
    let settle: (result: MediaResult | null) => void = () => {};
    const onRequestMedia = vi.fn(
      () =>
        new Promise<MediaResult | null>((resolve) => {
          settle = resolve;
        }),
    );
    return { onRequestMedia, settle: (r: MediaResult | null) => settle(r) };
  }

  const emittedUpload = (wrapper: VueWrapper): boolean =>
    JSON.stringify(wrapper.emitted()).includes(UPLOADED);

  it.each(callers)("$name keeps a URL typed during the upload", async (c) => {
    const upload = deferredUpload();
    const wrapper = c.mount(upload.onRequestMedia);

    dropImage();
    await nextTick();
    await c.retype(wrapper);
    upload.settle({ url: UPLOADED });
    await flushPromises();

    expect(upload.onRequestMedia).toHaveBeenCalledTimes(1);
    expect(emittedUpload(wrapper)).toBe(false);
  });

  it.each(callers)(
    "$name applies the upload when the URL is unchanged",
    async (c) => {
      const upload = deferredUpload();
      const wrapper = c.mount(upload.onRequestMedia);

      dropImage();
      await nextTick();
      upload.settle({ url: UPLOADED });
      await flushPromises();

      expect(emittedUpload(wrapper)).toBe(true);
    },
  );
});
