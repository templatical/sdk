// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createBackgroundImage } from "@templatical/types";
import type { BackgroundImage, MediaResult } from "@templatical/types";
import BackgroundImageControl from "../src/components/toolbar/BackgroundImageControl.vue";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import { RESOLVE_IMAGE_DEBOUNCE_MS } from "../src/constants/timeouts";
import {
  CAN_DROP_MEDIA_KEY,
  IMAGE_URL_RESOLVER_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
import { FAKE_IMAGE_LOAD_MS, stubImages } from "./helpers/fakeImage";
import { mountEditor } from "./helpers/mount";

const HERO = "https://cdn.test/hero.jpg";

function mountIt(
  modelValue: BackgroundImage | undefined,
  provides: Record<symbol, unknown> = {},
) {
  return mountEditor(BackgroundImageControl, {
    props: { modelValue, testidPrefix: "t" },
    provides: { [TRANSLATIONS_KEY]: en, ...provides },
  });
}

function lastEmitted(wrapper: ReturnType<typeof mountIt>) {
  const emitted = wrapper.emitted("update:modelValue")!;
  return emitted[emitted.length - 1][0] as BackgroundImage | undefined;
}

describe("BackgroundImageControl", () => {
  it("shows only the url field until an image is set", () => {
    const wrapper = mountIt(undefined);
    expect(wrapper.find('[data-testid="t-bg-url"] input').exists()).toBe(true);
    expect(wrapper.find('[data-testid="t-bg-size"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="t-bg-position"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="t-bg-repeat"]').exists()).toBe(false);
  });

  it("creates a default image from the first url", async () => {
    const wrapper = mountIt(undefined);
    await wrapper.find('[data-testid="t-bg-url"] input').setValue(HERO);
    expect(lastEmitted(wrapper)).toEqual(createBackgroundImage(HERO));
  });

  it("keeps size, position and repeat when the url changes", async () => {
    const current: BackgroundImage = {
      url: HERO,
      size: "contain",
      position: { x: "left", y: "bottom" },
      repeat: true,
    };
    const wrapper = mountIt(current);
    await wrapper
      .find('[data-testid="t-bg-url"] input')
      .setValue("https://cdn.test/other.jpg");
    expect(lastEmitted(wrapper)).toEqual({
      ...current,
      url: "https://cdn.test/other.jpg",
    });
  });

  it("removes the image when the url is cleared", async () => {
    const wrapper = mountIt(createBackgroundImage(HERO));
    await wrapper.find('[data-testid="t-bg-url"] input').setValue("  ");
    expect(lastEmitted(wrapper)).toBeUndefined();
  });

  it("switches the size", async () => {
    const wrapper = mountIt(createBackgroundImage(HERO));
    const pills = wrapper.findAll('[data-testid="t-bg-size"] [role="radio"]');
    expect(pills.map((p) => p.attributes("aria-label"))).toEqual([
      "Fill",
      "Fit",
      "Original",
    ]);
    await pills[1].trigger("click");
    expect(lastEmitted(wrapper)?.size).toBe("contain");
  });

  it("marks the current position and picks a new one", async () => {
    const wrapper = mountIt(createBackgroundImage(HERO));
    const center = wrapper.get('[data-testid="t-bg-position-center-center"]');
    expect(center.attributes("aria-pressed")).toBe("true");
    expect(
      wrapper
        .get('[data-testid="t-bg-position-top-left"]')
        .attributes("aria-pressed"),
    ).toBe("false");
    expect(
      wrapper.findAll('[data-testid^="t-bg-position-"]'),
    ).toHaveLength(9);

    await wrapper
      .get('[data-testid="t-bg-position-bottom-right"]')
      .trigger("click");
    expect(lastEmitted(wrapper)?.position).toEqual({ x: "right", y: "bottom" });
  });

  it("labels each position cell", () => {
    const wrapper = mountIt(createBackgroundImage(HERO));
    expect(
      wrapper
        .get('[data-testid="t-bg-position-top-left"]')
        .attributes("aria-label"),
    ).toBe("Top left");
  });

  it("toggles repeat", async () => {
    const wrapper = mountIt(createBackgroundImage(HERO));
    await wrapper.get('[data-testid="t-bg-repeat"] button').trigger("click");
    expect(lastEmitted(wrapper)?.repeat).toBe(true);
  });

  it("hides browse without a media handler", () => {
    expect(
      mountIt(undefined).find('[data-testid="t-bg-browse"]').exists(),
    ).toBe(false);
  });

  it("sets the url from the media browser", async () => {
    const onRequestMedia = vi.fn(async () => ({ url: HERO }));
    const wrapper = mountIt(undefined, {
      [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
    });
    await wrapper.get('[data-testid="t-bg-browse"]').trigger("click");
    await flushPromises();
    expect(onRequestMedia).toHaveBeenCalledWith({ accept: ["images"] });
    expect(lastEmitted(wrapper)).toEqual(createBackgroundImage(HERO));
  });

  it("leaves the image alone when the media browser is cancelled", async () => {
    const onRequestMedia = vi.fn(async () => null);
    const wrapper = mountIt(createBackgroundImage(HERO), {
      [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
    });
    await wrapper.get('[data-testid="t-bg-browse"]').trigger("click");
    await flushPromises();
    expect(onRequestMedia).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  describe("malformed JSON", () => {
    it("renders an image without a position and presses no cell", () => {
      const malformed = {
        ...createBackgroundImage(HERO),
        position: undefined,
      } as unknown as BackgroundImage;
      const wrapper = mountIt(malformed);
      const cells = wrapper.findAll('[data-testid^="t-bg-position-"]');
      expect(cells).toHaveLength(9);
      expect(cells.map((c) => c.attributes("aria-pressed"))).toEqual(
        Array(9).fill("false"),
      );
    });

    it("renders an image with a null position and presses no cell", () => {
      const malformed = {
        ...createBackgroundImage(HERO),
        position: null,
      } as unknown as BackgroundImage;
      const wrapper = mountIt(malformed);
      const cells = wrapper.findAll('[data-testid^="t-bg-position-"]');
      expect(cells.map((c) => c.attributes("aria-pressed"))).toEqual(
        Array(9).fill("false"),
      );
    });

    it("renders a non-string url as an empty field", () => {
      const malformed = {
        ...createBackgroundImage(HERO),
        url: 123,
      } as unknown as BackgroundImage;
      const wrapper = mountIt(malformed);
      expect(
        (
          wrapper.get('[data-testid="t-bg-url"] input')
            .element as HTMLInputElement
        ).value,
      ).toBe("");
      expect(wrapper.find('[data-testid="t-bg-size"]').exists()).toBe(false);
    });
  });

  describe("drop upload", () => {
    // The drop listener attaches once the zone's template ref resolves, a
    // tick after mount.
    async function dropOn(
      wrapper: ReturnType<typeof mountIt>,
      file: File,
    ): Promise<void> {
      await flushPromises();
      const zone = wrapper.get('[data-testid="t-bg-url"]').element;
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [file], items: [{ type: file.type }] },
      });
      zone.dispatchEvent(event);
    }

    async function dragOn(
      wrapper: ReturnType<typeof mountIt>,
      type: "dragenter" | "dragleave",
    ): Promise<void> {
      const zone = wrapper.get('[data-testid="t-bg-url"]').element;
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", {
        value: { files: [], items: [{ type: "image/png" }] },
      });
      zone.dispatchEvent(event);
      await nextTick();
    }

    function imageFile(): File {
      return new File(["data"], "hero.png", { type: "image/png" });
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

    it("uploads a dropped image and sets it with the defaults", async () => {
      const onRequestMedia = vi.fn(async () => ({ url: HERO }));
      const wrapper = mountIt(undefined, {
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
      });
      const file = new File(["data"], "hero.png", { type: "image/png" });

      await dropOn(wrapper, file);
      await flushPromises();

      expect(onRequestMedia).toHaveBeenCalledTimes(1);
      expect(onRequestMedia).toHaveBeenCalledWith({
        accept: ["images"],
        files: [file],
      });
      expect(lastEmitted(wrapper)).toEqual(createBackgroundImage(HERO));
    });

    it("shows the uploading state until the upload settles", async () => {
      let finish: (value: { url: string }) => void = () => {};
      const onRequestMedia = vi.fn(
        () =>
          new Promise<{ url: string }>((resolve) => {
            finish = resolve;
          }),
      );
      const wrapper = mountIt(undefined, {
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
      });

      await dropOn(
        wrapper,
        new File(["data"], "hero.png", { type: "image/png" }),
      );
      await flushPromises();
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).toContain(
        en.image.uploading,
      );

      finish({ url: HERO });
      await flushPromises();
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.uploading,
      );
      expect(lastEmitted(wrapper)).toEqual(createBackgroundImage(HERO));
    });

    it("ignores a drop while a merge-tag url is set", async () => {
      const onRequestMedia = vi.fn(async () => ({ url: HERO }));
      const wrapper = mountIt(createBackgroundImage("{{ hero_url }}"), {
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
      });

      await dropOn(
        wrapper,
        new File(["data"], "hero.png", { type: "image/png" }),
      );
      await flushPromises();

      expect(onRequestMedia).toHaveBeenCalledTimes(0);
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });

    it("highlights while an image is dragged over the field", async () => {
      const wrapper = mountIt(undefined, { [ON_REQUEST_MEDIA_KEY]: vi.fn() });
      await flushPromises();

      await dragOn(wrapper, "dragenter");
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).toContain(
        en.image.dropToUpload,
      );
      expect(wrapper.get(".lucide-upload").attributes("width")).toBe("18");

      await dragOn(wrapper, "dragleave");
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.dropToUpload,
      );
    });

    it("does not highlight over a merge-tag url", async () => {
      const wrapper = mountIt(createBackgroundImage("{{ hero_url }}"), {
        [ON_REQUEST_MEDIA_KEY]: vi.fn(),
      });
      await flushPromises();

      await dragOn(wrapper, "dragenter");
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.dropToUpload,
      );
    });

    it("accepts a drop over a non-string url", async () => {
      const onRequestMedia = vi.fn(async () => ({ url: HERO }));
      const malformed = {
        ...createBackgroundImage(HERO),
        url: 123,
      } as unknown as BackgroundImage;
      const wrapper = mountIt(malformed, {
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
      });

      await dropOn(wrapper, imageFile());
      await flushPromises();

      expect(onRequestMedia).toHaveBeenCalledTimes(1);
      expect(lastEmitted(wrapper)).toEqual({ ...malformed, url: HERO });
    });

    it("leaves the image alone when the upload is cancelled", async () => {
      const media = pendingMedia();
      const wrapper = mountIt(createBackgroundImage(HERO), {
        [ON_REQUEST_MEDIA_KEY]: media.fn,
      });

      await dropOn(wrapper, imageFile());
      await flushPromises();
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).toContain(
        en.image.uploading,
      );

      media.settle(null);
      await flushPromises();

      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.uploading,
      );
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });

    it("ignores a second drop while the first uploads", async () => {
      const media = pendingMedia();
      const wrapper = mountIt(undefined, { [ON_REQUEST_MEDIA_KEY]: media.fn });

      await dropOn(wrapper, imageFile());
      await flushPromises();
      await dragOn(wrapper, "dragenter");
      await dropOn(wrapper, imageFile());
      await flushPromises();

      expect(media.fn).toHaveBeenCalledTimes(1);
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.dropToUpload,
      );

      media.settle({ url: HERO });
      await flushPromises();
      expect(wrapper.emitted("update:modelValue")).toEqual([
        [createBackgroundImage(HERO)],
      ]);
    });

    it("ignores a drop when the library is read-only, but keeps browse", async () => {
      const onRequestMedia = vi.fn();
      const wrapper = mountIt(undefined, {
        [ON_REQUEST_MEDIA_KEY]: onRequestMedia,
        [CAN_DROP_MEDIA_KEY]: computed(() => false),
      });
      await flushPromises();

      await dragOn(wrapper, "dragenter");
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.dropToUpload,
      );

      await dropOn(wrapper, imageFile());
      await flushPromises();
      expect(onRequestMedia).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="t-bg-browse"]').exists()).toBe(true);
    });

    it("ignores a drop without a media handler", async () => {
      const wrapper = mountIt(undefined);
      await flushPromises();

      await dragOn(wrapper, "dragenter");
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.dropToUpload,
      );

      await dropOn(wrapper, imageFile());
      await flushPromises();
      expect(wrapper.get('[data-testid="t-bg-url"]').text()).not.toContain(
        en.image.uploading,
      );
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
  });
});

describe("BackgroundImageControl image size", () => {
  const OTHER = "https://cdn.test/other.jpg";

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mountMeasuring(
    modelValue: BackgroundImage | undefined,
    provides: Record<symbol, unknown> = {},
  ) {
    return mountEditor(BackgroundImageControl, {
      props: { modelValue, testidPrefix: "t", measure: true },
      provides: { [TRANSLATIONS_KEY]: en, ...provides },
    });
  }

  /** Type a url and feed the emitted image back, as the parent does. */
  async function typeUrl(wrapper: ReturnType<typeof mountMeasuring>, url: string) {
    await wrapper.find('[data-testid="t-bg-url"] input').setValue(url);
    await wrapper.setProps({ modelValue: lastEmitted(wrapper) });
  }

  it("drops the old image's size when the url changes", async () => {
    const wrapper = mountIt({
      ...createBackgroundImage(HERO),
      width: 1200,
      height: 800,
    });
    await wrapper.find('[data-testid="t-bg-url"] input').setValue(OTHER);
    expect(lastEmitted(wrapper)).toEqual(createBackgroundImage(OTHER));
  });

  it("measures the url the author sets, once typing settles", async () => {
    vi.useFakeTimers();
    const images = stubImages({ [HERO]: { width: 1200, height: 800 } });
    const wrapper = mountMeasuring(undefined);
    await typeUrl(wrapper, HERO);
    expect(images.requested).toEqual([]);

    await vi.advanceTimersByTimeAsync(
      RESOLVE_IMAGE_DEBOUNCE_MS + FAKE_IMAGE_LOAD_MS,
    );
    expect(images.requested).toEqual([HERO]);
    expect(lastEmitted(wrapper)).toEqual({
      ...createBackgroundImage(HERO),
      width: 1200,
      height: 800,
    });
  });

  it("measures the display url when a resolver is configured", async () => {
    vi.useFakeTimers();
    const images = stubImages({ [`blob:${HERO}`]: { width: 600, height: 300 } });
    const wrapper = mountMeasuring(undefined, {
      [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver((src) => `blob:${src}`),
    });
    await typeUrl(wrapper, HERO);
    await vi.advanceTimersByTimeAsync(
      RESOLVE_IMAGE_DEBOUNCE_MS + FAKE_IMAGE_LOAD_MS,
    );
    expect(images.requested).toEqual([`blob:${HERO}`]);
    expect(lastEmitted(wrapper)).toMatchObject({ width: 600, height: 300 });
  });

  it("drops a size measured for a url the author has since replaced", async () => {
    vi.useFakeTimers();
    stubImages({ [HERO]: { width: 1200, height: 800 } });
    const wrapper = mountMeasuring(undefined);
    await typeUrl(wrapper, HERO);
    await vi.advanceTimersByTimeAsync(RESOLVE_IMAGE_DEBOUNCE_MS);
    // HERO is loading; the image changes before it finishes.
    await wrapper.setProps({ modelValue: createBackgroundImage(OTHER) });
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    const emitted = wrapper.emitted("update:modelValue")!;
    expect(emitted.some(([value]) => (value as BackgroundImage).width)).toBe(
      false,
    );
  });

  it("does not measure without `measure`", async () => {
    vi.useFakeTimers();
    const images = stubImages({ [HERO]: { width: 1200, height: 800 } });
    const wrapper = mountIt(undefined);
    await wrapper.find('[data-testid="t-bg-url"] input').setValue(HERO);
    await vi.advanceTimersByTimeAsync(
      RESOLVE_IMAGE_DEBOUNCE_MS + FAKE_IMAGE_LOAD_MS,
    );
    expect(images.requested).toEqual([]);
  });

  it("does not measure a merge-tag url", async () => {
    vi.useFakeTimers();
    const images = stubImages({});
    const wrapper = mountMeasuring(undefined);
    await typeUrl(wrapper, "{{ hero_url }}");
    await vi.advanceTimersByTimeAsync(
      RESOLVE_IMAGE_DEBOUNCE_MS + FAKE_IMAGE_LOAD_MS,
    );
    expect(images.requested).toEqual([]);
  });

  it("hides size and repeat in hero mode, keeping the position", () => {
    const wrapper = mountEditor(BackgroundImageControl, {
      props: {
        modelValue: createBackgroundImage(HERO),
        testidPrefix: "t",
        heroMode: true,
      },
      provides: { [TRANSLATIONS_KEY]: en },
    });
    expect(wrapper.find('[data-testid="t-bg-size"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="t-bg-repeat"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="t-bg-position"]').exists()).toBe(true);
  });
});
