// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { createBackgroundImage } from "@templatical/types";
import type { BackgroundImage } from "@templatical/types";
import BackgroundImageControl from "../src/components/toolbar/BackgroundImageControl.vue";
import { ON_REQUEST_MEDIA_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
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
  });
});
