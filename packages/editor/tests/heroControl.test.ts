// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditor } from "@templatical/core";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
  type BackgroundImage,
  type SectionBlock,
  type TemplateContent,
} from "@templatical/types";
import HeroControl from "../src/components/toolbar/HeroControl.vue";
import { EDITOR_KEY, LAYOUT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";
import { FAKE_IMAGE_LOAD_MS, stubImages } from "./helpers/fakeImage";

const HERO = "https://cdn.test/hero.jpg";
const MEASURED: BackgroundImage = {
  ...createBackgroundImage(HERO),
  naturalWidth: 1200,
  naturalHeight: 800,
};

function mountHero(section: SectionBlock, layout?: TemplateContent) {
  const content = createDefaultTemplateContent();
  content.blocks = [section];
  return mountEditor(HeroControl, {
    props: { section },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [EDITOR_KEY]: useEditor({ content }),
      [LAYOUT_KEY]: layout,
    },
  });
}

/** A layout whose slot sits inside a card with `inset` px left and right. */
function cardLayout(inset: number): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.blocks = [
    createWrapperBlock({
      children: [createSlotBlock()],
      styles: { padding: { top: 0, right: inset, bottom: 0, left: inset } },
    }),
  ];
  return layout;
}

function updates(wrapper: ReturnType<typeof mountHero>) {
  return (wrapper.emitted("update") ?? []).map(([value]) => value);
}

function heightPill(wrapper: ReturnType<typeof mountHero>, label: string) {
  return wrapper
    .get('[data-testid="section-hero-height"]')
    .findAll('[role="radio"]')
    .find((pill) => pill.attributes("aria-label") === label)!;
}

describe("HeroControl", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows nothing for a one-column section with no image and no hero", () => {
    const wrapper = mountHero(createSectionBlock());
    expect(wrapper.find('[data-testid="section-hero"]').exists()).toBe(false);
  });

  it("offers the height once a one-column section has an image, starting at Fit content", () => {
    const wrapper = mountHero(createSectionBlock({ backgroundImage: MEASURED }));
    expect(
      heightPill(wrapper, en.blockSettings.heroHeightFit).attributes(
        "aria-checked",
      ),
    ).toBe("true");
    expect(wrapper.find('[data-testid="section-hero-align"]').exists()).toBe(
      false,
    );
  });

  it("turns on a matching hero, centred, for a measured image", async () => {
    const wrapper = mountHero(createSectionBlock({ backgroundImage: MEASURED }));
    await heightPill(wrapper, en.blockSettings.heroHeightImage).trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: "image", verticalAlign: "middle" } },
    ]);
  });

  it("measures an unmeasured image when it is matched", async () => {
    vi.useFakeTimers();
    stubImages({ [HERO]: { width: 1200, height: 800 } });
    const wrapper = mountHero(
      createSectionBlock({ backgroundImage: createBackgroundImage(HERO) }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightImage).trigger("click");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    expect(updates(wrapper)).toEqual([
      { hero: { height: "image", verticalAlign: "middle" } },
      { backgroundImage: MEASURED },
    ]);
  });

  it("starts a fixed height where the image ends in the box", async () => {
    const wrapper = mountHero(createSectionBlock({ backgroundImage: MEASURED }));
    await heightPill(wrapper, en.blockSettings.heroHeightFixed).trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: 400, verticalAlign: "middle" } },
    ]);
  });

  it("measures the box inside the section's wrapper padding", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        wrapper: { padding: { top: 0, right: 20, bottom: 0, left: 20 } },
      }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightFixed).trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: 373, verticalAlign: "middle" } },
    ]);
  });

  it("measures the box inside the padding of a layout card around the slot", async () => {
    const wrapper = mountHero(
      createSectionBlock({ backgroundImage: MEASURED }),
      cardLayout(20),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightFixed).trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: 373, verticalAlign: "middle" } },
    ]);
  });

  it("starts a fixed height at 300 when the image's size is unknown", async () => {
    const wrapper = mountHero(
      createSectionBlock({ backgroundImage: createBackgroundImage(HERO) }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightFixed).trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: 300, verticalAlign: "middle" } },
    ]);
  });

  it("keeps a typed fixed height when Fixed is clicked again", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: 500, verticalAlign: "middle" },
      }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightFixed).trigger("click");
    expect(updates(wrapper)).toEqual([]);
  });

  it("emits nothing when Fit content is clicked with no hero", async () => {
    const wrapper = mountHero(createSectionBlock({ backgroundImage: MEASURED }));
    await heightPill(wrapper, en.blockSettings.heroHeightFit).trigger("click");
    expect(updates(wrapper)).toEqual([]);
  });

  it("emits no hero update when Match image is clicked again, but retries a missing measurement", async () => {
    vi.useFakeTimers();
    stubImages({ [HERO]: { width: 1200, height: 800 } });
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: createBackgroundImage(HERO),
        hero: { height: "image", verticalAlign: "bottom" },
      }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightImage).trigger("click");
    await vi.advanceTimersByTimeAsync(FAKE_IMAGE_LOAD_MS);
    expect(updates(wrapper)).toEqual([{ backgroundImage: MEASURED }]);
  });

  it("emits nothing when Match image is clicked again on a measured image", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: "image", verticalAlign: "middle" },
      }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightImage).trigger("click");
    expect(updates(wrapper)).toEqual([]);
  });

  it("turns the hero off with Fit content", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: "image", verticalAlign: "top" },
      }),
    );
    await heightPill(wrapper, en.blockSettings.heroHeightFit).trigger("click");
    const [update] = updates(wrapper) as Array<Partial<SectionBlock>>;
    expect("hero" in update && update.hero === undefined).toBe(true);
  });

  it("disables Match image for a merge-tag url and says why", () => {
    const wrapper = mountHero(
      createSectionBlock({ backgroundImage: createBackgroundImage("{{ hero }}") }),
    );
    expect(
      heightPill(wrapper, en.blockSettings.heroHeightImage).attributes(
        "disabled",
      ),
    ).toBeDefined();
    expect(wrapper.text()).toContain(en.blockSettings.heroMatchImageMergeTag);
  });

  it("says when a matched image's size is unknown", () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: createBackgroundImage(HERO),
        hero: { height: "image", verticalAlign: "middle" },
      }),
    );
    expect(wrapper.text()).toContain(en.blockSettings.heroSizeUnknown);
  });

  it("edits a fixed height, rounding it and ignoring a non-positive one", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: 300, verticalAlign: "middle" },
      }),
    );
    const input = wrapper.get('[data-testid="section-hero-height-px"]');
    await input.setValue("420.4");
    await input.setValue("0");
    expect(updates(wrapper)).toEqual([
      { hero: { height: 420, verticalAlign: "middle" } },
    ]);
  });

  it("sets where the content sits", async () => {
    const wrapper = mountHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: "image", verticalAlign: "middle" },
      }),
    );
    const bottom = wrapper
      .get('[data-testid="section-hero-align"]')
      .findAll('[role="radio"]')
      .find((pill) => pill.attributes("aria-label") === en.blockSettings.heroAlignBottom)!;
    await bottom.trigger("click");
    expect(updates(wrapper)).toEqual([
      { hero: { height: "image", verticalAlign: "bottom" } },
    ]);
  });

  it("shows a note instead of the controls for a hero with two columns", () => {
    const wrapper = mountHero(
      createSectionBlock({
        columns: "2",
        children: [[], []],
        backgroundImage: MEASURED,
        hero: { height: "image", verticalAlign: "middle" },
      }),
    );
    expect(
      wrapper.get('[data-testid="section-hero-columns-note"]').text(),
    ).toBe(en.section.heroNeedsOneColumn);
    expect(wrapper.find('[data-testid="section-hero"]').exists()).toBe(false);
  });

  it("shows nothing for two columns without a hero", () => {
    const wrapper = mountHero(
      createSectionBlock({
        columns: "2",
        children: [[], []],
        backgroundImage: MEASURED,
      }),
    );
    expect(wrapper.find('[data-testid="section-hero"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="section-hero-columns-note"]').exists(),
    ).toBe(false);
  });
});
