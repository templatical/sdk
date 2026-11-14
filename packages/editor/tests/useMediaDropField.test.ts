// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, nextTick, ref, type Ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import type { MediaResult } from "@templatical/types";
import {
  useMediaDropField,
  type UseMediaDropFieldReturn,
} from "../src/composables/useMediaDropField";
import { CAN_DROP_MEDIA_KEY, ON_REQUEST_MEDIA_KEY } from "../src/keys";

interface HarnessOptions {
  onRequestMedia?: unknown;
  canDropMedia?: boolean;
  blocked?: Ref<boolean>;
  /** The field's value; `apply` writes the result's url into it. */
  value?: Ref<string>;
}

/** Mounts the composable on a plain zone and exposes what it returns. */
function mountHarness(options: HarnessOptions = {}) {
  const value = options.value ?? ref("");
  const apply = vi.fn<(result: MediaResult) => void>((result) => {
    value.value = result.url;
  });
  let field!: UseMediaDropFieldReturn;
  const Harness = defineComponent({
    setup() {
      const zone = ref<HTMLElement>();
      field = useMediaDropField({
        target: zone,
        blocked: options.blocked,
        value,
        apply,
      });
      return () => h("div", { ref: zone, "data-testid": "zone" });
    },
  });
  const wrapper = mount(Harness, {
    global: {
      provide: {
        [ON_REQUEST_MEDIA_KEY as symbol]: options.onRequestMedia ?? null,
        ...(options.canDropMedia === undefined
          ? {}
          : {
              [CAN_DROP_MEDIA_KEY as symbol]: computed(
                () => options.canDropMedia,
              ),
            }),
      },
    },
  });
  return { wrapper, apply, value, field: () => field };
}

/** An `onRequestMedia` whose calls each wait for their own `settle`. */
function deferredMedia() {
  const settles: Array<(result: MediaResult | null) => void> = [];
  const onRequestMedia = vi.fn(
    () =>
      new Promise<MediaResult | null>((resolve) => {
        settles.push(resolve);
      }),
  );
  return {
    onRequestMedia,
    settle: (call: number, result: MediaResult | null) => settles[call](result),
  };
}

function dispatchDrag(
  wrapper: ReturnType<typeof mountHarness>["wrapper"],
  type: "dragenter" | "drop",
): File {
  const file = new File(["data"], "up.png", { type: "image/png" });
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { files: [file], items: [{ type: file.type }] },
  });
  wrapper.get('[data-testid="zone"]').element.dispatchEvent(event);
  return file;
}

describe("useMediaDropField", () => {
  it("offers browse only with a media handler", () => {
    expect(mountHarness().field().canBrowse).toBe(false);
    expect(mountHarness({ onRequestMedia: vi.fn() }).field().canBrowse).toBe(
      true,
    );
  });

  it("applies a picked image and skips a cancelled pick", async () => {
    const onRequestMedia = vi
      .fn()
      .mockResolvedValueOnce({ url: "https://cdn/a.png", alt: "A" })
      .mockResolvedValueOnce(null);
    const { apply, field } = mountHarness({ onRequestMedia });

    await field().openMediaBrowser();
    await field().openMediaBrowser();

    expect(onRequestMedia).toHaveBeenNthCalledWith(1, { accept: ["images"] });
    expect(onRequestMedia).toHaveBeenNthCalledWith(2, { accept: ["images"] });
    expect(apply.mock.calls).toEqual([
      [{ url: "https://cdn/a.png", alt: "A" }],
    ]);
  });

  it("does nothing on browse without a media handler", async () => {
    const { apply, field } = mountHarness();

    await field().openMediaBrowser();

    expect(apply).not.toHaveBeenCalled();
  });

  it("uploads a dropped image and applies the result", async () => {
    let settle: (value: MediaResult | null) => void = () => {};
    const onRequestMedia = vi.fn(
      () =>
        new Promise<MediaResult | null>((resolve) => {
          settle = resolve;
        }),
    );
    const { wrapper, apply, field } = mountHarness({ onRequestMedia });
    await flushPromises();

    const file = dispatchDrag(wrapper, "drop");
    await nextTick();

    expect(onRequestMedia).toHaveBeenCalledWith({
      accept: ["images"],
      files: [file],
    });
    expect(field().isUploading.value).toBe(true);
    expect(field().dropEnabled.value).toBe(false);
    expect(field().showOverlay.value).toBe(true);

    settle({ url: "https://cdn/up.png" });
    await flushPromises();

    expect(field().isUploading.value).toBe(false);
    expect(field().dropEnabled.value).toBe(true);
    expect(field().showOverlay.value).toBe(false);
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/up.png" }]]);
  });

  it("keeps a value typed while a drop uploads", async () => {
    let settle: (value: MediaResult | null) => void = () => {};
    const onRequestMedia = vi.fn(
      () =>
        new Promise<MediaResult | null>((resolve) => {
          settle = resolve;
        }),
    );
    const value = ref("https://cdn/old.png");
    const { wrapper, apply, field } = mountHarness({ onRequestMedia, value });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    expect(field().isUploading.value).toBe(true);

    value.value = "https://typed.example/new.png";
    // The result can no longer land, so the field stops showing an upload.
    expect(field().isUploading.value).toBe(false);
    expect(field().showOverlay.value).toBe(false);
    expect(field().dropEnabled.value).toBe(true);

    settle({ url: "https://cdn/up.png" });
    await flushPromises();

    expect(value.value).toBe("https://typed.example/new.png");
    expect(apply).not.toHaveBeenCalled();
    expect(field().isUploading.value).toBe(false);
  });

  it("applies a drop onto an unchanged value", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { wrapper, apply } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    media.settle(0, { url: "https://cdn/up.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/up.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/up.png" }]]);
  });

  it("lets a later drop win when the earlier upload finishes last", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    value.value = "https://typed.example/new.png";
    dispatchDrag(wrapper, "drop");
    await nextTick();
    expect(media.onRequestMedia).toHaveBeenCalledTimes(2);
    expect(field().isUploading.value).toBe(true);

    media.settle(1, { url: "https://cdn/second.png" });
    await flushPromises();
    media.settle(0, { url: "https://cdn/first.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/second.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/second.png" }]]);
    expect(field().isUploading.value).toBe(false);
  });

  it("keeps the later drop uploading when the stale one finishes first", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    value.value = "https://typed.example/new.png";
    dispatchDrag(wrapper, "drop");
    await nextTick();

    media.settle(0, { url: "https://cdn/first.png" });
    await flushPromises();
    // The stale upload's end must not clear the later drop's state.
    expect(field().isUploading.value).toBe(true);
    expect(field().dropEnabled.value).toBe(false);
    expect(apply).not.toHaveBeenCalled();

    media.settle(1, { url: "https://cdn/second.png" });
    await flushPromises();
    expect(value.value).toBe("https://cdn/second.png");
    expect(field().isUploading.value).toBe(false);
  });

  it("lets a Browse pick made during an upload win", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    const browse = field().openMediaBrowser();
    media.settle(1, { url: "https://cdn/picked.png" });
    await browse;
    expect(value.value).toBe("https://cdn/picked.png");
    expect(field().isUploading.value).toBe(false);

    media.settle(0, { url: "https://cdn/up.png" });
    await flushPromises();
    expect(value.value).toBe("https://cdn/picked.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/picked.png" }]]);
  });

  it("applies a Browse pick even when the value changed while the picker was open", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });

    const browse = field().openMediaBrowser();
    value.value = "https://typed.example/new.png";
    media.settle(0, { url: "https://cdn/picked.png" });
    await browse;

    expect(value.value).toBe("https://cdn/picked.png");
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("keeps a later drop that returns the original URL", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/a.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    value.value = "https://typed.example/b.png";
    dispatchDrag(wrapper, "drop");
    await nextTick();

    media.settle(1, { url: "https://cdn/a.png" });
    await flushPromises();
    media.settle(0, { url: "https://cdn/stale.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/a.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/a.png" }]]);
    expect(field().isUploading.value).toBe(false);
  });

  it("lets a Browse pick of the original URL replace a pending drop", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/a.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    const browse = field().openMediaBrowser();
    media.settle(1, { url: "https://cdn/a.png" });
    await browse;
    expect(field().isUploading.value).toBe(false);
    expect(field().dropEnabled.value).toBe(true);

    media.settle(0, { url: "https://cdn/stale.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/a.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/a.png" }]]);
  });

  it("keeps a pending drop when a Browse pick is cancelled", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/a.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    const browse = field().openMediaBrowser();
    media.settle(1, null);
    await browse;
    expect(field().isUploading.value).toBe(true);

    media.settle(0, { url: "https://cdn/up.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/up.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/up.png" }]]);
  });

  // The owner chose the value snapshot over "any change discards": a URL
  // changed and changed back, with no newer drop or pick in this field, is
  // the URL the file was dropped on, so the upload lands.
  it("lands a drop when the URL is changed and changed back", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/a.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    value.value = "https://typed.example/b.png";
    expect(field().isUploading.value).toBe(false);
    value.value = "https://cdn/a.png";
    expect(field().isUploading.value).toBe(true);

    media.settle(0, { url: "https://cdn/up.png" });
    await flushPromises();

    expect(value.value).toBe("https://cdn/up.png");
    expect(apply.mock.calls).toEqual([[{ url: "https://cdn/up.png" }]]);
  });

  it("clears the uploading state when the drop upload is cancelled", async () => {
    const media = deferredMedia();
    const value = ref("https://cdn/old.png");
    const { wrapper, apply, field } = mountHarness({
      onRequestMedia: media.onRequestMedia,
      value,
    });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await nextTick();
    media.settle(0, null);
    await flushPromises();

    expect(field().isUploading.value).toBe(false);
    expect(field().dropEnabled.value).toBe(true);
    expect(value.value).toBe("https://cdn/old.png");
    expect(apply).not.toHaveBeenCalled();
  });

  it("shows the overlay while an image is dragged over an enabled zone", async () => {
    const enabled = mountHarness({ onRequestMedia: vi.fn() });
    const blocked = mountHarness({
      onRequestMedia: vi.fn(),
      blocked: ref(true),
    });
    await flushPromises();

    dispatchDrag(enabled.wrapper, "dragenter");
    dispatchDrag(blocked.wrapper, "dragenter");
    await nextTick();

    expect(enabled.field().showOverlay.value).toBe(true);
    expect(blocked.field().showOverlay.value).toBe(false);
  });

  it("follows a reactive blocked gate", async () => {
    const blocked = ref(true);
    const onRequestMedia = vi.fn(async () => ({ url: "https://cdn/up.png" }));
    const { wrapper, apply, field } = mountHarness({ onRequestMedia, blocked });
    await flushPromises();

    expect(field().dropEnabled.value).toBe(false);
    dispatchDrag(wrapper, "drop");
    await flushPromises();
    expect(onRequestMedia).not.toHaveBeenCalled();

    blocked.value = false;
    expect(field().dropEnabled.value).toBe(true);
    dispatchDrag(wrapper, "drop");
    await flushPromises();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("lets canDropMedia decide drop over the handler's presence", () => {
    expect(
      mountHarness({ onRequestMedia: vi.fn(), canDropMedia: false }).field()
        .dropEnabled.value,
    ).toBe(false);
    expect(mountHarness({ canDropMedia: true }).field().dropEnabled.value).toBe(
      true,
    );
  });

  it("leaves a drop inert without a media handler, even when drop is enabled", async () => {
    const { wrapper, apply, field } = mountHarness({ canDropMedia: true });
    await flushPromises();

    dispatchDrag(wrapper, "drop");
    await flushPromises();

    expect(field().isUploading.value).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
});
