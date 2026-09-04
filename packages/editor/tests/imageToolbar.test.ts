// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createImageBlock } from "@templatical/types";
import type { ImageBlock } from "@templatical/types";
import ImageToolbar from "../src/components/toolbar/ImageToolbar.vue";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
// French, not German: the German translation of "(optional)" is literally
// "(optional)", so it cannot distinguish a translated hint from a hardcoded one.
import fr from "../src/i18n/locales/fr";
import { TRANSLATIONS_KEY } from "../src/keys";

function mountIt(block: ImageBlock) {
  return mountEditor(ImageToolbar, { props: { block } });
}

describe("ImageToolbar width control", () => {
  it("switching the width <select> to Custom seeds the default custom width", async () => {
    // block.width = 400 is a preset, so widthMode resolves to "400" and the
    // custom px input is not yet shown.
    const wrapper = mountIt(createImageBlock({ width: 400 }));
    const select = wrapper.find("select");
    expect((select.element as HTMLSelectElement).value).toBe("400");

    await select.setValue("custom");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.width).toBe(350);
  });

  it("selecting Full width emits 'full'; selecting a preset emits the number", async () => {
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const select = wrapper.find("select");

    await select.setValue("full");
    await select.setValue("300");

    const emitted = wrapper.emitted("update") as [Partial<ImageBlock>][];
    expect(emitted[0][0].width).toBe("full");
    expect(emitted[1][0].width).toBe(300);
  });

  it("typing a valid custom width commits it as a number", async () => {
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);

    await input.setValue("420");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.width).toBe(420);
  });

  it("clearing or zeroing the custom width input never emits width: 0 (regression #259)", async () => {
    // An empty <input type="number"> yields Number("") === 0; committing that
    // would render an invisible 0px image. The guard must drop empty / 0 /
    // negative input and keep the last valid width.
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const input = wrapper.find('input[type="number"]');

    await input.setValue(""); // cleared
    await input.setValue("0"); // explicit zero
    await input.setValue("-5"); // negative

    expect(wrapper.emitted("update")).toBeUndefined();
  });
});

/**
 * The placeholder-image field only renders when `src` carries a merge tag: the
 * real image comes from the tag at send time, so this is a design-time stand-in
 * that never ships. That is not inferable from a URL input, which is what the
 * `title` is for — `VideoToolbar` has carried the same three strings on its own
 * placeholder field all along, while this one bound only two, leaving
 * `image.placeholderUrlTooltip` translated in seven locales and rendered nowhere.
 */
describe("ImageToolbar placeholder image field", () => {
  const withTag = () =>
    createImageBlock({ src: "{{hero_image}}" }) as ImageBlock;

  // Real `en` rather than the helper's stub translations: these cases assert on
  // the actual shipped strings, which is the whole point when the defect was a
  // translated string that reached no DOM node.
  const mountReal = (block: ImageBlock) =>
    mountEditor(ImageToolbar, {
      props: { block },
      provides: { [TRANSLATIONS_KEY]: en },
    });

  function placeholderInput(wrapper: ReturnType<typeof mountReal>) {
    return wrapper
      .findAll('input[type="url"]')
      .find(
        (i) =>
          i.attributes("placeholder") === en.image.placeholderUrlPlaceholder,
      );
  }

  it("renders only when src contains a merge tag", () => {
    expect(placeholderInput(mountReal(withTag()))).toBeDefined();
    expect(
      placeholderInput(mountReal(createImageBlock({ src: "https://x/y.png" }))),
    ).toBeUndefined();
  });

  it("explains itself through the title attribute", () => {
    const input = placeholderInput(mountReal(withTag()));
    expect(input!.attributes("title")).toBe(en.image.placeholderUrlTooltip);
  });

  /**
   * The "(optional)" hint was a hardcoded literal here — the last one in the
   * editor — so it stayed English in all seven locales while `VideoToolbar`'s
   * identical hint translated. Asserting a non-English locale is the point: an
   * `en` assertion passes against a hardcoded string.
   */
  it("translates the optional hint rather than hardcoding it", () => {
    const wrapper = mountEditor(ImageToolbar, {
      props: { block: withTag() },
      provides: { [TRANSLATIONS_KEY]: fr },
    });
    expect(wrapper.text()).toContain(fr.image.optional);
    expect(wrapper.text()).not.toContain("(optional)");
  });

  it("commits what is typed", async () => {
    const wrapper = mountReal(withTag());
    await placeholderInput(wrapper)!.setValue("https://cdn/fallback.png");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.placeholderUrl).toBe("https://cdn/fallback.png");
  });
});

/**
 * Height is optional and absent means MJML's `auto`, which is what preserves an
 * image's aspect ratio. So the control has two modes rather than a bare number
 * field: a stored `0` and a stored "no opinion" have to stay distinguishable,
 * and `Number("")` is `0`.
 */
describe("ImageToolbar height control", () => {
  const heightSelect = (w: ReturnType<typeof mountIt>) =>
    w.find('[data-testid="image-height-mode"]');
  const heightInput = (w: ReturnType<typeof mountIt>) =>
    w.find('[data-testid="image-height-input"]');

  it("reads Auto with no px input when the block stores no height", () => {
    const wrapper = mountIt(createImageBlock());
    expect((heightSelect(wrapper).element as HTMLSelectElement).value).toBe(
      "auto",
    );
    expect(heightInput(wrapper).exists()).toBe(false);
  });

  it("reads Custom with the stored value when the block stores a height", () => {
    const wrapper = mountIt(createImageBlock({ height: 180 }));
    expect((heightSelect(wrapper).element as HTMLSelectElement).value).toBe(
      "custom",
    );
    expect((heightInput(wrapper).element as HTMLInputElement).value).toBe(
      "180",
    );
  });

  it("switching to Custom seeds a default height", async () => {
    const wrapper = mountIt(createImageBlock());

    await heightSelect(wrapper).setValue("custom");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.height).toBe(200);
  });

  it("switching back to Auto clears the stored height", async () => {
    const wrapper = mountIt(createImageBlock({ height: 180 }));

    await heightSelect(wrapper).setValue("auto");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect("height" in update).toBe(true);
    expect(update.height).toBeUndefined();
  });

  it("typing a valid custom height commits it as a number", async () => {
    const wrapper = mountIt(createImageBlock({ height: 180 }));

    await heightInput(wrapper).setValue("240");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.height).toBe(240);
  });

  it("clearing or zeroing the custom height never emits height: 0", async () => {
    // Same guard as the custom width input (#259): an empty number field
    // yields Number("") === 0, which would collapse the image to nothing.
    const wrapper = mountIt(createImageBlock({ height: 180 }));
    const input = heightInput(wrapper);

    await input.setValue("");
    await input.setValue("0");
    await input.setValue("-5");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  // French, not English: an `en` assertion passes against a hardcoded label.
  it("translates the label and both modes", () => {
    const wrapper = mountEditor(ImageToolbar, {
      props: { block: createImageBlock({ height: 180 }) },
      provides: { [TRANSLATIONS_KEY]: fr },
    });
    const options = wrapper
      .find('[data-testid="image-height-mode"]')
      .findAll("option")
      .map((o) => o.text());

    expect(wrapper.text()).toContain(fr.image.height);
    expect(options).toEqual([fr.image.heightAuto, fr.image.heightCustom]);
  });
});

/**
 * Unlike height, the radius is a bare number field: 0 is a real answer (square
 * corners), so there is no "no opinion" state to keep distinguishable and an
 * emptied field committing 0 is what the author meant.
 */
describe("ImageToolbar corner radius control", () => {
  const radiusInput = (w: ReturnType<typeof mountIt>) =>
    w.find('[data-testid="image-border-radius-input"]');

  it("reads 0 when the block stores no radius", () => {
    const wrapper = mountIt(createImageBlock());
    expect((radiusInput(wrapper).element as HTMLInputElement).value).toBe("0");
  });

  it("reads the stored radius", () => {
    const wrapper = mountIt(createImageBlock({ borderRadius: 60 }));
    expect((radiusInput(wrapper).element as HTMLInputElement).value).toBe("60");
  });

  it("typing a radius commits it as a number", async () => {
    const wrapper = mountIt(createImageBlock());

    await radiusInput(wrapper).setValue("60");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.borderRadius).toBe(60);
  });

  it("clearing the field clears the radius rather than storing 0", async () => {
    const wrapper = mountIt(createImageBlock({ borderRadius: 60 }));

    await radiusInput(wrapper).setValue("");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    // Absent, not 0 — both render square, but only absence stays out of the
    // exported JSON. Asserted via the key so a stored 0 cannot pass.
    expect(update.borderRadius).toBeUndefined();
    expect("borderRadius" in update).toBe(true);
  });

  it("commits 0 typed explicitly as a cleared radius, not as a stored 0", async () => {
    const wrapper = mountIt(createImageBlock({ borderRadius: 60 }));

    await radiusInput(wrapper).setValue("0");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.borderRadius).toBeUndefined();
  });

  // `min="0"` only drives constraint validation — a number input still reports
  // "-5" as its value, so the guard is what keeps it out of the block.
  it("ignores a negative radius", async () => {
    const wrapper = mountIt(createImageBlock({ borderRadius: 60 }));

    await radiusInput(wrapper).setValue("-5");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  /**
   * The keystroke that opens a negative number is the trap. A number input
   * sanitizes an in-progress "-" to an EMPTY string and sets `validity.badInput`
   * — measured in Chrome, typing "-" fires `input` with value "" + badInput
   * true, and only the following "5" fires again with "-5". Read as a cleared
   * field, that first event wipes the stored radius before the guard above ever
   * sees a negative.
   *
   * happy-dom implements neither the sanitization nor `badInput`, so the two
   * are supplied here: that is what makes `setValue("-5")` above pass while the
   * real interaction was broken.
   */
  it("keeps the stored radius while a negative is mid-typing", async () => {
    const wrapper = mountIt(createImageBlock({ borderRadius: 60 }));
    const el = radiusInput(wrapper).element as HTMLInputElement;
    Object.defineProperty(el, "validity", {
      value: { badInput: true },
      configurable: true,
    });

    el.value = "";
    await radiusInput(wrapper).trigger("input");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  // French, not English: an `en` assertion passes against a hardcoded label.
  it("translates the label", () => {
    const wrapper = mountEditor(ImageToolbar, {
      props: { block: createImageBlock({ borderRadius: 60 }) },
      provides: { [TRANSLATIONS_KEY]: fr },
    });

    expect(wrapper.text()).toContain(fr.image.borderRadius);
  });
});
