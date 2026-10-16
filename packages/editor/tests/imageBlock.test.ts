import { computed, nextTick, shallowRef } from "vue";
// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import {
  SYNTAX_PRESETS,
  createImageBlock,
  uniformBorder,
} from "@templatical/types";
import type {
  ImageBlock as ImageBlockType,
  MediaResult,
} from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  CAN_DROP_MEDIA_KEY,
  IMAGE_URL_RESOLVER_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import ImageBlock from "../src/components/blocks/ImageBlock.vue";

function baseProvide() {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: shallowRef([]),
  };
}

describe("ImageBlock alignment (regression: #111)", () => {
  function mountImage(
    align: "left" | "center" | "right",
    width: number | "full",
  ) {
    const block = createImageBlock({
      src: "https://picsum.photos/600/400",
      width,
      align,
    });
    return mount(ImageBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("center alignment applies marginLeft: auto and marginRight: auto", () => {
    const wrapper = mountImage("center", 400);
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("auto");
    expect(style.width).toBe("400px");
  });

  it("right alignment applies marginLeft: auto only", () => {
    const wrapper = mountImage("right", 400);
    const img = wrapper.find("img");
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("");
  });

  it("left alignment applies no auto margins", () => {
    const wrapper = mountImage("left", 400);
    const img = wrapper.find("img");
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("");
    expect(style.marginRight).toBe("");
  });

  it("does not use the margin shorthand (prevents Vue's longhand-clear regression)", () => {
    const wrapper = mountImage("center", 400);
    const img = wrapper.find("img");
    const inline = img.attributes("style") ?? "";
    expect(inline).not.toMatch(/(^|;)\s*margin\s*:/);
  });
});

describe("ImageBlock display-only src resolution (#415)", () => {
  function mountWithResolver(
    blockOverrides: Parameters<typeof createImageBlock>[0],
    resolve: (src: string) => string | null | Promise<string | null>,
  ) {
    const block = createImageBlock(blockOverrides);
    const wrapper = mount(ImageBlock, {
      props: { block, viewport: "desktop" as const },
      global: {
        provide: {
          ...baseProvide(),
          [IMAGE_URL_RESOLVER_KEY as symbol]: createImageUrlResolver(resolve),
        },
      },
    });
    return { block, wrapper };
  }

  it("renders the resolved preview URL while block.src stays canonical", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { block, wrapper } = mountWithResolver({ src: "logo.png" }, resolve);

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe("blob:preview/logo.png");
    // Display-only: the content model and emitted updates are untouched.
    expect(block.src).toBe("logo.png");
    expect(wrapper.emitted("update")).toBe(undefined);
  });

  it("renders the resolved preview URL for a linked image", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { src: "logo.png", linkUrl: "https://example.com" },
      resolve,
    );

    await flushPromises();
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.find("img").attributes("src")).toBe("blob:preview/logo.png");
  });

  it("falls back to the canonical src when the resolver returns null", async () => {
    const resolve = vi.fn(async () => null);
    const { wrapper } = mountWithResolver(
      { src: "https://cdn.example.com/a.png" },
      resolve,
    );

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("never passes a merge-tag src to the resolver", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    mountWithResolver({ src: "{{ product.image }}" }, resolve);

    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolves the placeholder preview for a merge-tag src", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { src: "{{ product.image }}", placeholderUrl: "placeholder.png" },
      resolve,
    );

    await flushPromises();
    expect(resolve).toHaveBeenCalledWith("placeholder.png");
    expect(resolve).not.toHaveBeenCalledWith("{{ product.image }}");
    expect(wrapper.find("img").attributes("src")).toBe(
      "blob:preview/placeholder.png",
    );
  });
});

/**
 * The canvas has to stretch exactly like the delivered email: MJML writes the
 * height into the `<img>` inline style *and* attribute, and `object-fit` is
 * unsupported in Outlook and most clients — so cropping here instead of
 * stretching would make the preview a promise the email can't keep.
 */
describe("ImageBlock height", () => {
  function mountImage(block: ReturnType<typeof createImageBlock>) {
    return mount(ImageBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("applies a stored height to the img", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/600/400",
        width: 400,
        height: 180,
      }),
    );
    const style = (wrapper.find("img").element as HTMLElement).style;
    expect(style.height).toBe("180px");
    expect(style.width).toBe("400px");
  });

  it("leaves the img height unset when the block stores none", () => {
    const wrapper = mountImage(
      createImageBlock({ src: "https://picsum.photos/600/400", width: 400 }),
    );
    expect((wrapper.find("img").element as HTMLElement).style.height).toBe("");
  });

  it("never crops with object-fit", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/600/400",
        width: 400,
        height: 180,
      }),
    );
    expect((wrapper.find("img").element as HTMLElement).style.objectFit).toBe(
      "",
    );
  });
});

/**
 * The canvas is where an author judges whether a portrait actually reads as a
 * circle, so it has to round exactly as the delivered email does — MJML puts
 * the radius in the `<img>` inline style, and so does this.
 */
describe("ImageBlock corner radius", () => {
  function mountImage(block: ReturnType<typeof createImageBlock>) {
    return mount(ImageBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("applies a stored radius to the img", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        borderRadius: 120,
      }),
    );
    expect(
      (wrapper.find("img").element as HTMLElement).style.borderRadius,
    ).toBe("120px");
  });

  // Hand-authored JSON is the only way in — the toolbar and all three
  // importers refuse it — and the renderer omits the attribute for it, so the
  // canvas must too rather than promising corners the export will not deliver.
  it("leaves the img radius unset for a negative radius", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        borderRadius: -5,
      }),
    );
    expect(
      (wrapper.find("img").element as HTMLElement).style.borderRadius,
    ).toBe("");
  });

  it("leaves the img radius unset for 0 and for no radius at all", () => {
    const zero = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        borderRadius: 0,
      }),
    );
    const absent = mountImage(
      createImageBlock({ src: "https://picsum.photos/400/400", width: 240 }),
    );
    expect((zero.find("img").element as HTMLElement).style.borderRadius).toBe(
      "",
    );
    expect((absent.find("img").element as HTMLElement).style.borderRadius).toBe(
      "",
    );
  });
});

// The export puts `border` on the `<img>` (mj-image's own border), so the
// canvas borders the img itself, not the padded block box around it.
describe("ImageBlock border", () => {
  function mountImage(block: ReturnType<typeof createImageBlock>) {
    return mount(ImageBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("applies a stored border to the img", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        border: uniformBorder({ width: 3, style: "dashed", color: "#ff0000" }),
      }),
    );
    const style = (wrapper.find("img").element as HTMLElement).style;
    expect(style.borderWidth).toBe("3px");
    expect(style.borderStyle).toBe("dashed");
  });

  it("rounds only the chosen corners of the img", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        borderRadius: { topLeft: 12, topRight: 12, bottomRight: 0, bottomLeft: 0 },
      }),
    );
    expect(
      (wrapper.find("img").element as HTMLElement).style.borderRadius,
    ).toBe("12px 12px 0px 0px");
  });

  // MJML narrows a full-width <img> by its left and right borders, so a
  // bordered full-width image still fits its column in the email.
  it("narrows a full-width img by its drawn left and right borders", () => {
    const none = { width: 0, style: "solid" as const, color: "#000000" };
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: "full",
        border: {
          top: { width: 9, style: "solid", color: "#000000" },
          right: { width: 4, style: "solid", color: "#000000" },
          bottom: none,
          left: { width: 3, style: "dashed", color: "#000000" },
        },
      }),
    );
    expect((wrapper.find("img").element as HTMLElement).style.width).toBe(
      "calc(100% - 7px)",
    );
  });

  it("keeps a full-width img at 100% with no side borders drawn", () => {
    const none = { width: 0, style: "solid" as const, color: "#000000" };
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: "full",
        border: {
          top: { width: 4, style: "solid", color: "#000000" },
          right: none,
          bottom: { width: 4, style: "solid", color: "#000000" },
          left: none,
        },
      }),
    );
    expect((wrapper.find("img").element as HTMLElement).style.width).toBe(
      "100%",
    );
  });

  it("leaves a fixed-width img at its stored width", () => {
    const wrapper = mountImage(
      createImageBlock({
        src: "https://picsum.photos/400/400",
        width: 240,
        border: uniformBorder({ width: 4, style: "solid", color: "#000000" }),
      }),
    );
    expect((wrapper.find("img").element as HTMLElement).style.width).toBe(
      "240px",
    );
  });

  it("leaves the img border unset for no border or a 0 width", () => {
    for (const border of [
      undefined,
      uniformBorder({ width: 0, style: "solid", color: "#000000" }),
    ]) {
      const wrapper = mountImage(
        createImageBlock({
          src: "https://picsum.photos/400/400",
          width: 240,
          border,
        }),
      );
      expect((wrapper.find("img").element as HTMLElement).style.border).toBe(
        "",
      );
    }
  });
});

const HERO = "https://cdn/up.png";

// The zone reads the dragged type from `items` and the dropped file from
// `files`, so one shape serves every drag event.
function dragEvent(type: "dragenter" | "dragleave" | "drop"): Event {
  const file = new File(["data"], "up.png", { type: "image/png" });
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { files: [file], items: [{ type: file.type }] },
  });
  return event;
}

/** An `onRequestMedia` that stays pending until the test settles it. */
function pendingMedia() {
  let settle: (value: MediaResult | null) => void = () => {};
  const fn = vi.fn(
    () =>
      new Promise<MediaResult | null>((resolve) => {
        settle = resolve;
      }),
  );
  return { fn, settle: (value: MediaResult | null) => settle(value) };
}

function mountWithMedia(
  block: ImageBlockType,
  onRequestMedia: unknown,
  provides: Record<symbol, unknown> = {},
) {
  return mount(ImageBlock, {
    props: { block, viewport: "desktop" },
    global: {
      provide: {
        ...baseProvide(),
        [ON_REQUEST_MEDIA_KEY as symbol]: onRequestMedia,
        ...provides,
      },
    },
  });
}

function dropZone(wrapper: VueWrapper) {
  return wrapper.get('[data-testid="image-drop-zone"]');
}

function browseButton(wrapper: VueWrapper) {
  return wrapper.find(
    `button[aria-label="${enTranslations.image.browseMedia}"]`,
  );
}

describe("ImageBlock media browser", () => {
  it("sets src and alt from the picked image in one update", async () => {
    const onRequestMedia = vi.fn(async () => ({ url: HERO, alt: "Hero" }));
    const wrapper = mountWithMedia(
      createImageBlock({ src: "" }),
      onRequestMedia,
    );

    await browseButton(wrapper).trigger("click");
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    expect(wrapper.emitted("update")).toEqual([[{ src: HERO, alt: "Hero" }]]);
  });

  it("sets only src when the picked image has no alt", async () => {
    const wrapper = mountWithMedia(
      createImageBlock({ src: "" }),
      vi.fn(async () => ({ url: HERO })),
    );

    await browseButton(wrapper).trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update")).toEqual([[{ src: HERO }]]);
  });

  it("leaves the block alone when the media browser is cancelled", async () => {
    const onRequestMedia = vi.fn(async () => null);
    const wrapper = mountWithMedia(
      createImageBlock({ src: "" }),
      onRequestMedia,
    );

    await browseButton(wrapper).trigger("click");
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("offers browse only with a media handler", () => {
    const withHandler = mountWithMedia(createImageBlock({ src: "" }), vi.fn());
    const without = mountWithMedia(createImageBlock({ src: "" }), null);

    expect(browseButton(withHandler).exists()).toBe(true);
    expect(browseButton(without).exists()).toBe(false);
    expect(without.text()).toContain(enTranslations.image.clickToAdd);
  });
});

describe("ImageBlock drag-and-drop upload (#229)", () => {
  it("shows the uploading state until the upload settles", async () => {
    let finish: (value: { url: string }) => void = () => {};
    const onRequestMedia = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = mount(ImageBlock, {
      props: { block: createImageBlock({ src: "" }), viewport: "desktop" },
      global: {
        provide: {
          ...baseProvide(),
          [ON_REQUEST_MEDIA_KEY as symbol]: onRequestMedia,
        },
      },
    });
    const file = new File(["data"], "up.png", { type: "image/png" });

    // The drop listener attaches once the zone's template ref resolves, a
    // tick after mount.
    await flushPromises();
    const zone = wrapper.get('[data-testid="image-drop-zone"]');
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { files: [file], items: [{ type: file.type }] },
    });
    zone.element.dispatchEvent(event);
    await flushPromises();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ["images"],
      files: [file],
    });
    expect(zone.text()).toContain(enTranslations.image.uploading);

    finish({ url: "https://cdn/up.png" });
    await flushPromises();

    expect(zone.text()).not.toContain(enTranslations.image.uploading);
    expect(wrapper.emitted("update")).toEqual([
      [{ src: "https://cdn/up.png" }],
    ]);
  });

  it("highlights while an image is dragged over the block", async () => {
    const wrapper = mountWithMedia(createImageBlock({ src: HERO }), vi.fn());
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("true");

    dropZone(wrapper).element.dispatchEvent(dragEvent("dragenter"));
    await nextTick();
    expect(dropZone(wrapper).text()).toContain(
      enTranslations.image.dropToUpload,
    );
    // The canvas draws the overlay larger than a sidebar field does.
    expect(dropZone(wrapper).get(".lucide-upload").attributes("width")).toBe(
      "20",
    );

    dropZone(wrapper).element.dispatchEvent(dragEvent("dragleave"));
    await nextTick();
    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.dropToUpload,
    );
  });

  it("sets src and alt from a dropped image in one update", async () => {
    const wrapper = mountWithMedia(
      createImageBlock({ src: "" }),
      vi.fn(async () => ({ url: HERO, alt: "Hero" })),
    );
    await flushPromises();

    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();

    expect(wrapper.emitted("update")).toEqual([[{ src: HERO, alt: "Hero" }]]);
  });

  it("leaves the block alone when the upload is cancelled", async () => {
    const media = pendingMedia();
    const wrapper = mountWithMedia(createImageBlock({ src: "" }), media.fn);
    await flushPromises();

    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();
    expect(dropZone(wrapper).text()).toContain(enTranslations.image.uploading);

    media.settle(null);
    await flushPromises();

    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.uploading,
    );
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("ignores a second drop while the first uploads", async () => {
    const media = pendingMedia();
    const wrapper = mountWithMedia(createImageBlock({ src: "" }), media.fn);
    await flushPromises();

    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("false");
    dropZone(wrapper).element.dispatchEvent(dragEvent("dragenter"));
    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();

    expect(media.fn).toHaveBeenCalledTimes(1);
    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.dropToUpload,
    );

    media.settle({ url: HERO });
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("true");
    expect(wrapper.emitted("update")).toEqual([[{ src: HERO }]]);
  });

  it("ignores a drop on a merge-tag src", async () => {
    const onRequestMedia = vi.fn();
    const wrapper = mountWithMedia(
      createImageBlock({ src: "{{ user.avatar }}" }),
      onRequestMedia,
    );
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("false");

    dropZone(wrapper).element.dispatchEvent(dragEvent("dragenter"));
    await nextTick();
    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.dropToUpload,
    );

    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();
    expect(onRequestMedia).not.toHaveBeenCalled();
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("ignores a drop when the library is read-only, but keeps browse", async () => {
    const onRequestMedia = vi.fn();
    const wrapper = mountWithMedia(
      createImageBlock({ src: "" }),
      onRequestMedia,
      { [CAN_DROP_MEDIA_KEY as symbol]: computed(() => false) },
    );
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("false");

    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();
    expect(onRequestMedia).not.toHaveBeenCalled();
    expect(browseButton(wrapper).exists()).toBe(true);
  });

  it("ignores a drop without a media handler", async () => {
    const wrapper = mountWithMedia(createImageBlock({ src: "" }), null);
    await flushPromises();
    expect(dropZone(wrapper).attributes("data-drop-enabled")).toBe("false");

    dropZone(wrapper).element.dispatchEvent(dragEvent("dragenter"));
    dropZone(wrapper).element.dispatchEvent(dragEvent("drop"));
    await flushPromises();

    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.dropToUpload,
    );
    expect(dropZone(wrapper).text()).not.toContain(
      enTranslations.image.uploading,
    );
    expect(wrapper.emitted("update")).toBeUndefined();
  });
});
