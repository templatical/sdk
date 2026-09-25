// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset } from "@templatical/types";
import { MEDIA_LIMITS_KEY } from "../src/keys";

const { cropGetResult, canvasToFile, resizeCanvas, CropperStub } = vi.hoisted(
  () => {
    const cropGetResult = vi.fn(() => ({
      canvas: { width: 800, height: 600 } as HTMLCanvasElement,
    }));
    return {
      cropGetResult,
      canvasToFile: vi.fn(
        async () => new File(["cropped"], "hero.jpg", { type: "image/jpeg" }),
      ),
      resizeCanvas: vi.fn((canvas: HTMLCanvasElement) => canvas),
      CropperStub: {
        name: "Cropper",
        props: ["src", "stencilProps"],
        emits: ["change", "ready"],
        template: '<div data-testid="cropper" />',
        methods: {
          getResult() {
            return cropGetResult();
          },
        },
      },
    };
  },
);

vi.mock("vue-advanced-cropper", () => ({
  Cropper: CropperStub,
}));

vi.mock("vue-advanced-cropper/dist/style.css", () => ({}));

vi.mock("../src/composables/useImageCrop", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/composables/useImageCrop")>();
  return {
    ...actual,
    canvasToFile,
    resizeCanvas,
  };
});

import MediaEditModal from "../src/components/media/MediaEditModal.vue";

function createAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "hero",
    url: "https://cdn.example.com/hero.jpg",
    filename: "hero.jpg",
    mimeType: "image/jpeg",
    size: 2048,
    thumbnailUrl: "https://cdn.example.com/hero-thumb.jpg",
    alt: "Launch hero",
    width: 800,
    height: 600,
    ...overrides,
  };
}

const wrappers: VueWrapper[] = [];

function buttonByText(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === label,
  );
  if (!match) {
    throw new Error(`button "${label}" not found`);
  }
  return match;
}

function mountEdit(
  item: MediaAsset | null,
  extra: { visible?: boolean } = {},
): VueWrapper {
  const wrapper = mount(MediaEditModal, {
    props: {
      visible: extra.visible ?? true,
      item,
    },
    attachTo: document.body,
    global: {
      provide: {
        [MEDIA_LIMITS_KEY]: {},
      },
      stubs: {
        Transition: {
          inheritAttrs: false,
          setup(
            _props: unknown,
            { slots }: { slots: { default?: () => unknown } },
          ) {
            return () => slots.default?.();
          },
        },
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
  cropGetResult.mockClear();
  canvasToFile.mockClear();
  resizeCanvas.mockClear();
});

describe("MediaEditModal seeds from the item it mounts with", () => {
  it("fills filename and alt when chrome mounts it already visible", async () => {
    // Chrome does `v-if="editingItem"` + `:visible="true"`, so this watch
    // must run on mount. Without `{ immediate: true }` the fields stay empty
    // and Save no-ops because the filename is blank.
    mountEdit(createAsset());
    await nextTick();

    const filename = document.querySelector<HTMLInputElement>(
      "#tpl-media-filename",
    );
    const alt = document.querySelector<HTMLInputElement>("#tpl-media-alt");
    expect(filename?.value).toBe("hero.jpg");
    expect(alt?.value).toBe("Launch hero");
  });
});

describe("MediaEditModal crop surface", () => {
  it("shows the cropper for jpeg/png/webp/gif and hides it for svg and pdf", async () => {
    mountEdit(createAsset({ mimeType: "image/jpeg" }));
    await nextTick();
    expect(document.querySelector('[data-testid="cropper"]')).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    mountEdit(
      createAsset({
        id: "mark",
        filename: "mark.svg",
        mimeType: "image/svg+xml",
        url: "https://cdn.example.com/mark.svg",
      }),
    );
    await nextTick();
    expect(document.querySelector('[data-testid="cropper"]')).toBeNull();
    expect(document.querySelector("#tpl-media-alt")).not.toBeNull();

    wrappers.pop()?.unmount();
    document.body.innerHTML = "";

    mountEdit(
      createAsset({
        id: "doc",
        filename: "brief.pdf",
        mimeType: "application/pdf",
        url: "https://cdn.example.com/brief.pdf",
      }),
    );
    await nextTick();
    expect(document.querySelector('[data-testid="cropper"]')).toBeNull();
    expect(document.querySelector("#tpl-media-alt")).toBeNull();
  });

  it("saves filename and alt without crop data when the crop was not moved", async () => {
    const wrapper = mountEdit(createAsset());
    await nextTick();

    buttonByText("Save").click();
    await flushPromises();

    expect(canvasToFile).not.toHaveBeenCalled();
    expect(wrapper.emitted("save")).toEqual([
      ["hero", "hero.jpg", "Launch hero", undefined],
    ]);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("omits alt for a non-image and refuses a blank filename", async () => {
    const wrapper = mountEdit(
      createAsset({
        id: "doc",
        filename: "brief.pdf",
        mimeType: "application/pdf",
        url: "https://cdn.example.com/brief.pdf",
      }),
    );
    await nextTick();

    const filename = document.querySelector<HTMLInputElement>(
      "#tpl-media-filename",
    )!;
    filename.value = "   ";
    filename.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    buttonByText("Save").click();
    await flushPromises();
    expect(wrapper.emitted("save")).toBeUndefined();

    filename.value = "brief-final.pdf";
    filename.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    buttonByText("Save").click();
    await flushPromises();

    expect(wrapper.emitted("save")).toEqual([
      ["doc", "brief-final.pdf", undefined, undefined],
    ]);
  });

  it("exports a cropped file after the user changes the crop", async () => {
    const wrapper = mountEdit(createAsset());
    await nextTick();

    const cropper = wrapper.findComponent({ name: "Cropper" });
    cropper.vm.$emit("change", {
      coordinates: { width: 400, height: 300 },
    });
    await nextTick();

    expect(document.body.textContent).toContain("400 x 300 px");

    buttonByText("Save").click();
    await flushPromises();

    expect(resizeCanvas).toHaveBeenCalled();
    expect(canvasToFile).toHaveBeenCalled();
    const save = wrapper.emitted("save")?.[0];
    expect(save?.[0]).toBe("hero");
    expect(save?.[1]).toBe("hero.jpg");
    expect(save?.[2]).toBe("Launch hero");
    expect((save?.[3] as { file: File }).file).toBeInstanceOf(File);
  });

  it("does not save when the cropper export throws", async () => {
    cropGetResult.mockImplementationOnce(() => {
      throw new Error("crop failed");
    });
    const wrapper = mountEdit(createAsset());
    await nextTick();

    wrapper.findComponent({ name: "Cropper" }).vm.$emit("change", {
      coordinates: { width: 100, height: 100 },
    });
    await nextTick();

    buttonByText("Save").click();
    await flushPromises();

    expect(wrapper.emitted("save")).toBeUndefined();
    expect(buttonByText("Save").disabled).toBe(false);
  });

  it("applies max width to the output size and the export", async () => {
    const wrapper = mountEdit(createAsset());
    await nextTick();

    wrapper.findComponent({ name: "Cropper" }).vm.$emit("change", {
      coordinates: { width: 800, height: 600 },
    });
    await nextTick();

    const widthInput = document.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    )[0];
    widthInput.value = "400";
    widthInput.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    expect(document.body.textContent).toContain("400 x 300 px");

    buttonByText("Save").click();
    await flushPromises();

    expect(resizeCanvas).toHaveBeenCalledWith(
      expect.anything(),
      400,
      undefined,
    );
  });

  it("uses the item's own ratio for Original", async () => {
    const wrapper = mountEdit(createAsset({ width: 1600, height: 900 }));
    await nextTick();

    buttonByText("Original").click();
    await nextTick();

    const cropper = wrapper.findComponent({ name: "Cropper" });
    expect(cropper.props("stencilProps")).toEqual({
      aspectRatio: 1600 / 900,
    });
  });
});

describe("MediaEditModal keyboard and overlay", () => {
  it("saves on Enter and closes on Escape", async () => {
    const wrapper = mountEdit(createAsset());
    await nextTick();

    const overlay = document.querySelector('[role="dialog"]')!.parentElement!;
    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("save")).toHaveLength(1);

    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("close")?.length).toBeGreaterThanOrEqual(1);
  });

  it("closes from Cancel", async () => {
    const wrapper = mountEdit(createAsset());
    await nextTick();
    buttonByText("Cancel").click();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
