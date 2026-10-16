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
}

/** Mounts the composable on a plain zone and exposes what it returns. */
function mountHarness(options: HarnessOptions = {}) {
  const apply = vi.fn<(result: MediaResult) => void>();
  let field!: UseMediaDropFieldReturn;
  const Harness = defineComponent({
    setup() {
      const zone = ref<HTMLElement>();
      field = useMediaDropField({
        target: zone,
        blocked: options.blocked,
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
  return { wrapper, apply, field: () => field };
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
