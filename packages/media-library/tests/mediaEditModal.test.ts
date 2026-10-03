// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { MediaAsset } from "@templatical/types";
import { MEDIA_LIMITS_KEY } from "../src/keys";
import type {
  MediaEditSave,
  MediaEditSaveResult,
} from "../src/components/media/MediaEditModal.vue";

const SOURCE_CANVAS = { width: 800, height: 600 } as HTMLCanvasElement;
const FULL_IMAGE = { left: 0, top: 0, width: 800, height: 600 };

const { cropGetResult, canvasToFile, resizeCanvas, CropperStub } = vi.hoisted(
  () => {
    const cropGetResult = vi.fn(() => ({
      canvas: { width: 800, height: 600 } as HTMLCanvasElement | null,
      coordinates: { left: 0, top: 0, width: 800, height: 600 },
    }));
    return {
      cropGetResult,
      canvasToFile: vi.fn(
        async () => new File(["cropped"], "hero.jpg", { type: "image/jpeg" }),
      ),
      resizeCanvas: vi.fn((canvas: HTMLCanvasElement) => canvas),
      CropperStub: {
        name: "Cropper",
        props: ["src", "stencilProps", "defaultSize"],
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
  extra: {
    visible?: boolean;
    canCrop?: boolean;
    save?: ReturnType<typeof vi.fn<MediaEditSave>>;
  } = {},
): { wrapper: VueWrapper; save: ReturnType<typeof vi.fn<MediaEditSave>> } {
  const save =
    extra.save ??
    vi.fn<MediaEditSave>(async () => "saved" as MediaEditSaveResult);
  const wrapper = mount(MediaEditModal, {
    props: {
      visible: extra.visible ?? true,
      item,
      save,
      canCrop: extra.canCrop ?? true,
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
  return { wrapper, save };
}

function cropper(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "Cropper" });
}

/**
 * What vue-advanced-cropper does once the image loads: `ready`, then a
 * `change` carrying its default box. The stub must replay it, or a test of
 * "Save without touching the crop" passes without exercising the load event
 * at all, which is how #834 shipped.
 */
async function loadImage(
  wrapper: VueWrapper,
  box: typeof FULL_IMAGE = FULL_IMAGE,
): Promise<void> {
  cropper(wrapper).vm.$emit("ready");
  cropper(wrapper).vm.$emit("change", { coordinates: box });
  await nextTick();
}

async function moveCrop(
  wrapper: VueWrapper,
  box: typeof FULL_IMAGE,
): Promise<void> {
  cropper(wrapper).vm.$emit("change", { coordinates: box });
  await nextTick();
}

async function typeMaxWidth(value: string): Promise<void> {
  const widthInput = document.querySelectorAll<HTMLInputElement>(
    'input[type="number"]',
  )[0];
  widthInput.value = value;
  widthInput.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

function errorText(): string | null {
  return (
    document.querySelector("#tpl-media-edit-error")?.textContent?.trim() ?? null
  );
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
  cropGetResult.mockClear();
  canvasToFile.mockClear();
  resizeCanvas.mockClear();
  resizeCanvas.mockImplementation((canvas: HTMLCanvasElement) => canvas);
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
  it("shows the cropper for jpeg, png and webp", async () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      mountEdit(createAsset({ mimeType }));
      await nextTick();
      expect(
        document.querySelector('[data-testid="cropper"]'),
        mimeType,
      ).not.toBeNull();
      wrappers.pop()?.unmount();
      document.body.innerHTML = "";
    }
  });

  it("hides the cropper for a GIF, whose canvas export would drop the animation", async () => {
    mountEdit(
      createAsset({
        filename: "spinner.gif",
        mimeType: "image/gif",
        url: "https://cdn.example.com/spinner.gif",
      }),
    );
    await nextTick();
    expect(document.querySelector('[data-testid="cropper"]')).toBeNull();
    expect(document.querySelector('input[type="number"]')).toBeNull();
    expect(document.querySelector("#tpl-media-alt")).not.toBeNull();
  });

  it("hides the cropper for svg and pdf", async () => {
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

  it("hides the cropper when the provider cannot replace the file", async () => {
    mountEdit(createAsset(), { canCrop: false });
    await nextTick();
    expect(document.querySelector('[data-testid="cropper"]')).toBeNull();
    expect(document.querySelector("#tpl-media-alt")).not.toBeNull();
  });

  it("starts the crop box on the whole image", async () => {
    const { wrapper } = mountEdit(createAsset());
    await nextTick();

    const defaultSize = cropper(wrapper).props("defaultSize") as (args: {
      imageSize: { width: number; height: number };
    }) => { width: number; height: number };
    expect(defaultSize({ imageSize: { width: 1600, height: 900 } })).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("uses the item's own ratio for Original", async () => {
    const { wrapper } = mountEdit(createAsset({ width: 1600, height: 900 }));
    await nextTick();

    buttonByText("Original").click();
    await nextTick();

    expect(cropper(wrapper).props("stencilProps")).toEqual({
      aspectRatio: 1600 / 900,
    });
  });
});

describe("MediaEditModal sends a file only for a real edit (#834)", () => {
  it("does not replace the image when only the alt text changed", async () => {
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper, { left: 80, top: 60, width: 640, height: 480 });

    const alt = document.querySelector<HTMLInputElement>("#tpl-media-alt")!;
    alt.value = "Launch hero, updated";
    alt.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();

    buttonByText("Save").click();
    await flushPromises();

    expect(cropGetResult).not.toHaveBeenCalled();
    expect(canvasToFile).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      "hero",
      "hero.jpg",
      "Launch hero, updated",
      undefined,
    );
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("treats a later change with the load-time box as no crop", async () => {
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    // A window resize makes the cropper re-emit the same box.
    await moveCrop(wrapper, { ...FULL_IMAGE });

    buttonByText("Save").click();
    await flushPromises();

    expect(canvasToFile).not.toHaveBeenCalled();
    expect(save.mock.calls[0][3]).toBeUndefined();
  });

  it("treats a box dragged back to where it started as no crop", async () => {
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await moveCrop(wrapper, { left: 100, top: 100, width: 400, height: 300 });
    await moveCrop(wrapper, { left: 0.2, top: 0, width: 799.6, height: 600 });

    buttonByText("Save").click();
    await flushPromises();

    expect(canvasToFile).not.toHaveBeenCalled();
    expect(save.mock.calls[0][3]).toBeUndefined();
  });

  it("exports a cropped file after the user changes the crop", async () => {
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await moveCrop(wrapper, { left: 200, top: 150, width: 400, height: 300 });

    expect(document.body.textContent).toContain("400 x 300 px");

    buttonByText("Save").click();
    await flushPromises();

    expect(resizeCanvas).toHaveBeenCalledWith(
      SOURCE_CANVAS,
      undefined,
      undefined,
    );
    expect(canvasToFile).toHaveBeenCalledTimes(1);
    const [id, filename, alt, cropData] = save.mock.calls[0];
    expect([id, filename, alt]).toEqual(["hero", "hero.jpg", "Launch hero"]);
    expect(cropData?.file.name).toBe("hero.jpg");
    expect(cropData?.file.type).toBe("image/jpeg");
  });

  it("exports a scaled file when only a max width was entered", async () => {
    const scaled = { width: 400, height: 300 } as HTMLCanvasElement;
    resizeCanvas.mockImplementation(() => scaled);
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await typeMaxWidth("400");

    expect(document.body.textContent).toContain("400 x 300 px");

    buttonByText("Save").click();
    await flushPromises();

    expect(resizeCanvas).toHaveBeenCalledWith(SOURCE_CANVAS, 400, undefined);
    expect(canvasToFile).toHaveBeenCalledWith(
      scaled,
      "hero.jpg",
      expect.objectContaining({ mimeType: "image/jpeg" }),
    );
    expect(save.mock.calls[0][3]?.file.name).toBe("hero.jpg");
  });

  it("sends no file when the max width is larger than the image", async () => {
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await typeMaxWidth("2000");

    buttonByText("Save").click();
    await flushPromises();

    expect(resizeCanvas).toHaveBeenCalledWith(SOURCE_CANVAS, 2000, undefined);
    expect(canvasToFile).not.toHaveBeenCalled();
    expect(save.mock.calls[0][3]).toBeUndefined();
  });
});

describe("MediaEditModal failures stay visible", () => {
  it("shows an error and keeps the dialog open when the export throws", async () => {
    cropGetResult.mockImplementationOnce(() => {
      throw new Error("tainted canvas");
    });
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await moveCrop(wrapper, { left: 0, top: 0, width: 100, height: 100 });

    buttonByText("Save").click();
    await flushPromises();

    expect(save).not.toHaveBeenCalled();
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(errorText()).toBe("Couldn't process the edited image. Try again.");
    expect(
      document.querySelector("#tpl-media-edit-error")?.getAttribute("role"),
    ).toBe("alert");
    expect(buttonByText("Save").disabled).toBe(false);
  });

  it("shows an error when the cropper has no canvas to export", async () => {
    cropGetResult.mockImplementationOnce(() => ({
      canvas: null,
      coordinates: FULL_IMAGE,
    }));
    const { wrapper, save } = mountEdit(createAsset());
    await nextTick();
    await loadImage(wrapper);
    await moveCrop(wrapper, { left: 0, top: 0, width: 100, height: 100 });

    buttonByText("Save").click();
    await flushPromises();

    expect(save).not.toHaveBeenCalled();
    expect(errorText()).toBe("Couldn't process the edited image. Try again.");
  });

  it("stays open with an error when the save fails, and clears it on retry", async () => {
    const save = vi
      .fn<MediaEditSave>()
      .mockResolvedValueOnce("failed")
      .mockResolvedValueOnce("saved");
    const { wrapper } = mountEdit(createAsset(), { save });
    await nextTick();

    buttonByText("Save").click();
    await flushPromises();

    expect(wrapper.emitted("close")).toBeUndefined();
    expect(errorText()).toBe("Couldn't save your changes. Try again.");
    expect(buttonByText("Save").disabled).toBe(false);

    buttonByText("Save").click();
    await flushPromises();

    expect(save).toHaveBeenCalledTimes(2);
    expect(errorText()).toBeNull();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("does not send the cropped file again after it was already replaced", async () => {
    const save = vi
      .fn<MediaEditSave>()
      .mockResolvedValueOnce("replaced")
      .mockResolvedValueOnce("saved");
    const { wrapper } = mountEdit(createAsset(), { save });
    await nextTick();
    await loadImage(wrapper);
    await moveCrop(wrapper, { left: 200, top: 150, width: 400, height: 300 });
    cropGetResult.mockImplementation(() => ({
      canvas: SOURCE_CANVAS,
      coordinates: { left: 200, top: 150, width: 400, height: 300 },
    }));
    await typeMaxWidth("300");

    buttonByText("Save").click();
    await flushPromises();
    expect(save.mock.calls[0][3]?.file.name).toBe("hero.jpg");
    expect(errorText()).toBe("Couldn't save your changes. Try again.");

    buttonByText("Save").click();
    await flushPromises();

    expect(save.mock.calls[1][3]).toBeUndefined();
    expect(canvasToFile).toHaveBeenCalledTimes(1);
    expect(
      document.querySelectorAll<HTMLInputElement>('input[type="number"]')[0]
        ?.value,
    ).toBe("");
    cropGetResult.mockReset();
  });

  it("ignores Cancel, Escape and the backdrop while a save is in flight", async () => {
    let finish!: (result: MediaEditSaveResult) => void;
    const save = vi.fn<MediaEditSave>(
      () =>
        new Promise<MediaEditSaveResult>((resolve) => {
          finish = resolve;
        }),
    );
    const { wrapper } = mountEdit(createAsset(), { save });
    await nextTick();

    buttonByText("Save").click();
    await nextTick();

    const overlay = document.querySelector('[role="dialog"]')!.parentElement!;
    expect(buttonByText("Cancel").disabled).toBe(true);
    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted("close")).toBeUndefined();

    finish("saved");
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});

describe("MediaEditModal fields", () => {
  it("omits alt for a non-image and refuses a blank filename", async () => {
    const { save } = mountEdit(
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
    expect(save).not.toHaveBeenCalled();

    filename.value = "brief-final.pdf";
    filename.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    buttonByText("Save").click();
    await flushPromises();

    expect(save.mock.calls).toEqual([
      ["doc", "brief-final.pdf", undefined, undefined],
    ]);
  });
});

describe("MediaEditModal keyboard and overlay", () => {
  it("saves on Enter and closes on Escape", async () => {
    const save = vi.fn<MediaEditSave>(async () => "failed");
    const { wrapper } = mountEdit(createAsset(), { save });
    await nextTick();

    const overlay = document.querySelector('[role="dialog"]')!.parentElement!;
    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("close")).toBeUndefined();

    overlay.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("closes from Cancel", async () => {
    const { wrapper } = mountEdit(createAsset());
    await nextTick();
    buttonByText("Cancel").click();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
