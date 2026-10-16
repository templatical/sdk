// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createImageBlock,
} from "@templatical/types";
import type { ImageBlock } from "@templatical/types";
import ImageToolbar from "../src/components/toolbar/ImageToolbar.vue";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
import fr from "../src/i18n/locales/fr";
import {
  EDITOR_KEY,
  ON_REQUEST_MEDIA_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";

const loads: FakeImage[] = [];
class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  src = "";
  constructor() {
    loads.push(this);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  loads.length = 0;
});

// A 3:1 file in a top-level block: 600px body less 10px padding each side
// gives 580px of room.
function banner(partial: Partial<ImageBlock> = {}): ImageBlock {
  return createImageBlock({
    id: "img",
    src: "https://cdn.test/banner.png",
    width: 300,
    naturalWidth: 1200,
    naturalHeight: 400,
    ...partial,
  });
}

function mountIt(
  block: ImageBlock,
  provides: Record<symbol, unknown> = {},
): VueWrapper {
  vi.stubGlobal("Image", FakeImage);
  const content = ref({ ...createDefaultTemplateContent(), blocks: [block] });
  return mountEditor(ImageToolbar, {
    props: { block },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [EDITOR_KEY]: { content },
      ...provides,
    },
  });
}

const lockToggle = (w: VueWrapper) =>
  w.find('[data-testid="image-aspect-lock"]');
const lockedHeight = (w: VueWrapper) =>
  w.find('[data-testid="image-locked-height-input"]');
const heightMode = (w: VueWrapper) =>
  w.find('[data-testid="image-height-mode"]');
const updates = (w: VueWrapper) =>
  (w.emitted("update") ?? []).map(([u]) => u as Partial<ImageBlock>);

describe("ImageToolbar aspect-ratio lock", () => {
  it("is offered, on, once the file's size is known", () => {
    const wrapper = mountIt(banner());
    expect(lockToggle(wrapper).attributes("aria-pressed")).toBe("true");
    expect(lockToggle(wrapper).attributes("aria-label")).toBe(
      en.image.unlockAspectRatio,
    );
    expect((lockedHeight(wrapper).element as HTMLInputElement).value).toBe(
      "100",
    );
    expect(heightMode(wrapper).exists()).toBe(false);
  });

  it("isn't offered without a size, and the height controls stay as they were", () => {
    const wrapper = mountIt(
      banner({ src: "", naturalWidth: undefined, naturalHeight: undefined }),
    );
    expect(lockToggle(wrapper).exists()).toBe(false);
    expect(heightMode(wrapper).exists()).toBe(true);
  });

  it("turns a typed height into a width and keeps the height on Auto", async () => {
    const wrapper = mountIt(banner());
    await lockedHeight(wrapper).setValue("40");
    expect(updates(wrapper)).toStrictEqual([{ width: 120, height: undefined }]);
  });

  it("caps a height that would overflow the column and says so", async () => {
    const wrapper = mountIt(banner());
    await lockedHeight(wrapper).setValue("300");
    expect(updates(wrapper)).toStrictEqual([
      { width: "full", height: undefined },
    ]);
    const hint = wrapper.find('[data-testid="image-height-capped"]');
    expect(hint.text()).toBe("Capped at the column width, 193px tall");
    expect(hint.attributes("role")).toBe("status");
    // The field keeps what was typed while it has focus.
    expect((lockedHeight(wrapper).element as HTMLInputElement).value).toBe(
      "300",
    );
  });

  it("clears the height with a width edit under the lock", async () => {
    const wrapper = mountIt(banner({ width: 400 }));
    await wrapper.find("select").setValue("500");
    expect(updates(wrapper)).toStrictEqual([{ width: 500, height: undefined }]);
  });

  it("turning it off brings back the Auto / Custom controls and changes nothing", async () => {
    const wrapper = mountIt(banner());
    await lockToggle(wrapper).trigger("click");
    expect(lockToggle(wrapper).attributes("aria-pressed")).toBe("false");
    expect(heightMode(wrapper).exists()).toBe(true);
    expect(lockedHeight(wrapper).exists()).toBe(false);
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("opens a stretched legacy image unlocked; turning it on drops the height", async () => {
    const wrapper = mountIt(banner({ height: 300 }));
    expect(lockToggle(wrapper).attributes("aria-pressed")).toBe("false");
    expect((heightMode(wrapper).element as HTMLSelectElement).value).toBe(
      "custom",
    );
    await lockToggle(wrapper).trigger("click");
    expect(updates(wrapper)).toStrictEqual([{ height: undefined }]);
  });

  it("clears the stored size when src is edited", async () => {
    const wrapper = mountIt(banner());
    await wrapper.get('input[type="url"]').setValue("https://cdn.test/new.png");
    expect(updates(wrapper)[0]).toStrictEqual({
      src: "https://cdn.test/new.png",
      naturalWidth: undefined,
      naturalHeight: undefined,
    });
  });

  it("stores the size a media pick carries", async () => {
    const onRequestMedia = vi.fn(async () => ({
      url: "https://cdn.test/logo.png",
      width: 240,
      height: 80,
    }));
    const wrapper = mountIt(
      banner({ src: "", naturalWidth: undefined, naturalHeight: undefined }),
      { [ON_REQUEST_MEDIA_KEY]: onRequestMedia },
    );
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes(en.image.browseMedia))!
      .trigger("click");
    await flushPromises();
    expect(updates(wrapper)).toStrictEqual([
      {
        src: "https://cdn.test/logo.png",
        naturalWidth: 240,
        naturalHeight: 80,
      },
    ]);
  });

  it("measures an image without a stored size, and writes the size only with an edit", async () => {
    const wrapper = mountIt(
      banner({ naturalWidth: undefined, naturalHeight: undefined }),
    );
    expect(loads.map((image) => image.src)).toEqual([
      "https://cdn.test/banner.png",
    ]);
    expect(lockToggle(wrapper).exists()).toBe(false);

    loads[0].naturalWidth = 600;
    loads[0].naturalHeight = 300;
    loads[0].onload!();
    await nextTick();

    expect(lockToggle(wrapper).attributes("aria-pressed")).toBe("true");
    expect(wrapper.emitted("update")).toBeUndefined();

    await lockedHeight(wrapper).setValue("50");
    expect(updates(wrapper)).toStrictEqual([
      { width: 100, height: undefined, naturalWidth: 600, naturalHeight: 300 },
    ]);
  });

  it("doesn't measure a merge-tag src, which names no file", () => {
    const wrapper = mountIt(
      banner({
        src: "{{ logo_url }}",
        naturalWidth: undefined,
        naturalHeight: undefined,
      }),
    );
    expect(loads).toHaveLength(0);
    expect(lockToggle(wrapper).exists()).toBe(false);
  });

  it("doesn't measure when the block stores a size", () => {
    mountIt(banner());
    expect(loads).toHaveLength(0);
  });

  it("translates the toggle and the cap hint", async () => {
    const wrapper = mountIt(banner(), { [TRANSLATIONS_KEY]: fr });
    expect(lockToggle(wrapper).attributes("aria-label")).toBe(
      fr.image.unlockAspectRatio,
    );
    await lockedHeight(wrapper).setValue("300");
    expect(wrapper.find('[data-testid="image-height-capped"]').text()).toBe(
      "Limitée à la largeur de la colonne, 193px de haut",
    );
  });
});
