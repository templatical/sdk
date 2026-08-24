// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createVideoBlock } from "@templatical/types";
import type { VideoBlock } from "@templatical/types";
import VideoToolbar from "../src/components/toolbar/VideoToolbar.vue";
import { mountEditor } from "./helpers/mount";
// French, not English: an `en` assertion passes against a hardcoded label.
import fr from "../src/i18n/locales/fr";
import { TRANSLATIONS_KEY } from "../src/keys";

function mountIt(block: VideoBlock) {
  return mountEditor(VideoToolbar, { props: { block } });
}

/**
 * The video thumbnail ships as an `mj-image`, so its height behaves exactly
 * like the image block's: optional, and absent means MJML's `auto`. Hence two
 * modes rather than a bare number field — `Number("")` is `0`, so a stored `0`
 * and a stored "no opinion" would otherwise be indistinguishable.
 */
describe("VideoToolbar height control", () => {
  const heightSelect = (w: ReturnType<typeof mountIt>) =>
    w.find('[data-testid="video-height-mode"]');
  const heightInput = (w: ReturnType<typeof mountIt>) =>
    w.find('[data-testid="video-height-input"]');

  it("reads Auto with no px input when the block stores no height", () => {
    const wrapper = mountIt(createVideoBlock());
    expect((heightSelect(wrapper).element as HTMLSelectElement).value).toBe(
      "auto",
    );
    expect(heightInput(wrapper).exists()).toBe(false);
  });

  it("reads Custom with the stored value when the block stores a height", () => {
    const wrapper = mountIt(createVideoBlock({ height: 220 }));
    expect((heightSelect(wrapper).element as HTMLSelectElement).value).toBe(
      "custom",
    );
    expect((heightInput(wrapper).element as HTMLInputElement).value).toBe("220");
  });

  it("switching to Custom seeds a default height", async () => {
    const wrapper = mountIt(createVideoBlock());

    await heightSelect(wrapper).setValue("custom");

    const [update] = wrapper.emitted("update")![0] as [Partial<VideoBlock>];
    expect(update.height).toBe(200);
  });

  it("switching back to Auto clears the stored height", async () => {
    const wrapper = mountIt(createVideoBlock({ height: 220 }));

    await heightSelect(wrapper).setValue("auto");

    const [update] = wrapper.emitted("update")![0] as [Partial<VideoBlock>];
    expect("height" in update).toBe(true);
    expect(update.height).toBeUndefined();
  });

  it("typing a valid custom height commits it as a number", async () => {
    const wrapper = mountIt(createVideoBlock({ height: 220 }));

    await heightInput(wrapper).setValue("300");

    const [update] = wrapper.emitted("update")![0] as [Partial<VideoBlock>];
    expect(update.height).toBe(300);
  });

  it("clearing or zeroing the custom height never emits height: 0", async () => {
    // Same guard as the image block's custom width input (#259): an empty
    // number field yields Number("") === 0, collapsing the thumbnail.
    const wrapper = mountIt(createVideoBlock({ height: 220 }));
    const input = heightInput(wrapper);

    await input.setValue("");
    await input.setValue("0");
    await input.setValue("-5");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("translates the label and both modes", () => {
    const wrapper = mountEditor(VideoToolbar, {
      props: { block: createVideoBlock({ height: 220 }) },
      provides: { [TRANSLATIONS_KEY]: fr },
    });
    const options = wrapper
      .find('[data-testid="video-height-mode"]')
      .findAll("option")
      .map((o) => o.text());

    expect(wrapper.text()).toContain(fr.video.height);
    expect(options).toEqual([fr.video.heightAuto, fr.video.heightCustom]);
  });
});
