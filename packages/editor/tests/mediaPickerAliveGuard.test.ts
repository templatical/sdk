// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { SYNTAX_PRESETS } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import ImageBlock from "../src/components/blocks/ImageBlock.vue";
import ImageToolbar from "../src/components/toolbar/ImageToolbar.vue";
import VideoToolbar from "../src/components/toolbar/VideoToolbar.vue";
import ImageField from "../src/components/toolbar/fields/ImageField.vue";

interface MediaResolver {
  resolveWithObservable: () => { urlReadAfterResolve: () => boolean };
}

/**
 * Builds an `onRequestMedia` stub that returns a controllable Promise.
 * Resolving it provides a media object whose `url` getter sets a flag —
 * this lets the test observe whether the caller's post-`await` branch
 * runs (Vue silently no-ops `emit` on an unmounted instance, so checking
 * `wrapper.emitted()` would mask the bug).
 */
function setupOnRequestMedia(): {
  fn: ReturnType<typeof vi.fn>;
  next: () => MediaResolver;
} {
  const queue: Array<(value: { url: string; alt?: string } | null) => void> = [];
  const fn = vi.fn(
    () =>
      new Promise<{ url: string; alt?: string } | null>((resolve) => {
        queue.push(resolve);
      }),
  );
  return {
    fn,
    next: () => {
      const resolve = queue.shift();
      if (!resolve) throw new Error("no pending media request");
      return {
        resolveWithObservable: () => {
          let urlRead = false;
          const result = {
            get url() {
              urlRead = true;
              return "after-unmount.png";
            },
            alt: "Late",
          };
          resolve(result);
          return { urlReadAfterResolve: () => urlRead };
        },
      };
    },
  };
}

function baseProvide(onRequestMedia: unknown) {
  return {
    [ON_REQUEST_MEDIA_KEY as symbol]: onRequestMedia,
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: [],
  };
}

describe("media picker alive guard", () => {
  it("ImageBlock does not emit update after the component unmounts", async () => {
    const media = setupOnRequestMedia();
    const wrapper = mount(ImageBlock, {
      props: {
        block: {
          id: "img-1",
          type: "image",
          src: "",
          alt: "",
          width: "full",
          align: "center",
          linkUrl: "",
          placeholderUrl: "",
          styles: {},
        } as any,
        viewport: "desktop",
      },
      global: {
        provide: baseProvide(media.fn),
      },
    });

    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    await button.trigger("click");
    expect(media.fn).toHaveBeenCalled();

    wrapper.unmount();
    const observable = media.next().resolveWithObservable();
    await nextTick();

    expect(observable.urlReadAfterResolve()).toBe(false);
  });

  it("ImageToolbar does not emit update after the component unmounts", async () => {
    const media = setupOnRequestMedia();
    const wrapper = mount(ImageToolbar, {
      props: {
        block: {
          id: "img-1",
          type: "image",
          src: "https://example.com/initial.png",
          alt: "",
          width: "full",
          align: "center",
          linkUrl: "",
          placeholderUrl: "",
          styles: {},
        } as any,
      },
      global: {
        provide: baseProvide(media.fn),
      },
    });

    const browseButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes(enTranslations.image.browseMedia));
    expect(browseButton).toBeTruthy();
    await browseButton!.trigger("click");
    expect(media.fn).toHaveBeenCalled();

    wrapper.unmount();
    const observable = media.next().resolveWithObservable();
    await nextTick();

    expect(observable.urlReadAfterResolve()).toBe(false);
  });

  it("VideoToolbar does not emit update after the component unmounts", async () => {
    const media = setupOnRequestMedia();
    const wrapper = mount(VideoToolbar, {
      props: {
        block: {
          id: "vid-1",
          type: "video",
          url: "https://example.com/video.mp4",
          thumbnailUrl: "",
          width: "full",
          align: "center",
          styles: {},
        } as any,
      },
      global: {
        provide: baseProvide(media.fn),
      },
    });

    const browseButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes(enTranslations.image.browseMedia));
    expect(browseButton).toBeTruthy();
    await browseButton!.trigger("click");
    expect(media.fn).toHaveBeenCalled();

    wrapper.unmount();
    const observable = media.next().resolveWithObservable();
    await nextTick();

    expect(observable.urlReadAfterResolve()).toBe(false);
  });

  it("ImageField does not emit update:modelValue after the component unmounts", async () => {
    const media = setupOnRequestMedia();
    const wrapper = mount(ImageField, {
      props: {
        field: {
          key: "hero",
          type: "image",
          label: "Hero image",
        } as any,
        modelValue: "",
      },
      global: {
        provide: baseProvide(media.fn),
      },
    });

    const browseButton = wrapper
      .findAll("button")
      .find((b) => b.text().includes(enTranslations.image.browseMedia));
    expect(browseButton).toBeTruthy();
    await browseButton!.trigger("click");
    expect(media.fn).toHaveBeenCalled();

    wrapper.unmount();
    const observable = media.next().resolveWithObservable();
    await nextTick();

    expect(observable.urlReadAfterResolve()).toBe(false);
  });
});
