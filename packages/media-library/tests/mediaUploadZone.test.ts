// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { MEDIA_LIMITS_KEY, UI_LOCALE_KEY, type MediaLimits } from "../src/keys";

const picker = vi.hoisted(() => ({
  onChange: null as ((files: FileList | File[] | null) => void) | null,
}));

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useFileDialog: () => ({
      open: vi.fn(),
      onChange: (cb: (files: FileList | File[] | null) => void) => {
        picker.onChange = cb;
      },
    }),
  };
});

import MediaUploadZone from "../src/components/media/MediaUploadZone.vue";

const MB = 1024 * 1024;
const wrappers: VueWrapper[] = [];

function mountZone(
  limits: MediaLimits,
  locale?: string,
): VueWrapper<InstanceType<typeof MediaUploadZone>> {
  const wrapper = mount(MediaUploadZone, {
    props: { isUploading: false, uploadProgress: null },
    attachTo: document.body,
    global: {
      provide: {
        [MEDIA_LIMITS_KEY]: limits,
        [UI_LOCALE_KEY]: ref(locale),
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

function hint(): string | undefined {
  return document
    .querySelector('[data-testid="media-upload-hint"]')
    ?.textContent?.trim();
}

function rejected(): string | undefined {
  return document
    .querySelector('[data-testid="media-upload-rejected"]')
    ?.textContent?.trim();
}

function file(name: string, type: string, size: number): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  document.body.innerHTML = "";
  picker.onChange = null;
});

describe("MediaUploadZone accepted-formats hint", () => {
  it("names the categories and the size cap the provider set", () => {
    mountZone({
      maxFileSize: 5 * MB,
      mimeTypes: {
        images: ["image/png", "image/jpeg"],
        documents: ["application/pdf"],
      },
    });
    expect(hint()).toBe("Images, Documents (max 5 MB)");
  });

  it("narrows to the host's accept list", () => {
    mountZone({
      maxFileSize: 1.5 * MB,
      accept: ["images"],
      mimeTypes: {
        images: ["image/png"],
        documents: ["application/pdf"],
      },
    });
    expect(hint()).toBe("Images (max 1.5 MB)");
  });

  it("says any type when the provider sets no mimeTypes", () => {
    mountZone({ maxFileSize: 10 * MB });
    expect(hint()).toBe("Any file type (max 10 MB)");
  });

  it("drops the size when there is no cap", () => {
    mountZone({ mimeTypes: { videos: ["video/mp4"] } });
    expect(hint()).toBe("Videos");
  });

  it("joins the list the way the UI locale writes one", () => {
    mountZone(
      {
        mimeTypes: {
          images: ["image/png"],
          videos: ["video/mp4"],
          audio: ["audio/mpeg"],
        },
      },
      "ja",
    );
    expect(hint()).toBe("Images、Videos、Audio");
  });

  it("falls back to the runtime locale for a malformed tag", () => {
    mountZone(
      { mimeTypes: { images: ["image/png"], audio: ["audio/mpeg"] } },
      "not a locale!",
    );
    expect(hint()).toBe(
      new Intl.ListFormat(undefined, {
        style: "narrow",
        type: "conjunction",
      }).format(["Images", "Audio"]),
    );
  });

  it("describes the zone button with the hint", () => {
    mountZone({ maxFileSize: 10 * MB });
    const zone = document.querySelector('[data-testid="media-upload-zone"]');
    expect(zone?.getAttribute("aria-describedby")).toBe(
      "tpl-media-upload-hint",
    );
  });
});

describe("MediaUploadZone rejected files", () => {
  const limits: MediaLimits = {
    maxFileSize: 1 * MB,
    mimeTypes: { images: ["image/png"] },
  };

  it("uploads the accepted files and names the rejected ones", async () => {
    const wrapper = mountZone(limits);
    const ok = file("ok.png", "image/png", 1000);
    picker.onChange!([
      ok,
      file("huge.png", "image/png", 2 * MB),
      file("clip.mov", "video/quicktime", 1000),
    ]);
    await nextTick();

    expect(wrapper.emitted("upload")).toEqual([[[ok]]]);
    expect(rejected()).toBe(
      "Not uploaded, type or size not accepted: huge.png, clip.mov",
    );
    expect(
      document
        .querySelector('[data-testid="media-upload-rejected"]')
        ?.getAttribute("role"),
    ).toBe("alert");
  });

  it("reports a pick where every file is rejected and uploads nothing", async () => {
    const wrapper = mountZone(limits);
    picker.onChange!([file("huge.png", "image/png", 2 * MB)]);
    await nextTick();

    expect(wrapper.emitted("upload")).toBeUndefined();
    expect(rejected()).toBe(
      "Not uploaded, type or size not accepted: huge.png",
    );
  });

  it("clears the message on the next clean pick", async () => {
    mountZone(limits);
    picker.onChange!([file("huge.png", "image/png", 2 * MB)]);
    await nextTick();
    expect(rejected()).toContain("huge.png");

    picker.onChange!([file("ok.png", "image/png", 1000)]);
    await nextTick();
    expect(rejected()).toBeUndefined();
  });
});
