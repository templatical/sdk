// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";
import {
  SYNTAX_PRESETS,
  createBackgroundImage,
  createSectionBlock,
  type SectionBlock,
} from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import { IMAGE_URL_RESOLVER_KEY, MERGE_TAG_SYNTAX_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * Section background images on the main canvas. `getBlockWrapperStyle` and
 * `getSectionWrapperStyle` are covered in blockComponentResolver.test.ts;
 * these prove `BlockWrapper` feeds them the `config.resolveImageUrl` result
 * for the section box and for its `wrapper` frame, independently.
 */

function sectionWithImages(): SectionBlock {
  return createSectionBlock({
    backgroundImage: createBackgroundImage("hero.jpg"),
    wrapper: { backgroundImage: createBackgroundImage("band.jpg") },
  });
}

function mountWrapper(
  block: SectionBlock,
  resolver?: ReturnType<typeof createImageUrlResolver>,
  provides: Record<symbol, unknown> = {},
) {
  return mountEditor(BlockWrapper, {
    props: {
      block,
      isSelected: false,
      viewport: "desktop" as const,
      previewMode: false,
    },
    slots: { default: () => h("div", "child") },
    provides: resolver
      ? { [IMAGE_URL_RESOLVER_KEY]: resolver, ...provides }
      : provides,
  } as never);
}

describe("BlockWrapper background images", () => {
  it("paints the section box and its wrapper frame through resolveImageUrl", async () => {
    const block = sectionWithImages();
    const wrapper = mountWrapper(
      block,
      createImageUrlResolver((src) => `blob:${src}`),
    );
    await flushPromises();

    expect(wrapper.get(".tpl-block-content").attributes("style")).toContain(
      'background-image: url("blob:hero.jpg")',
    );
    expect(wrapper.get(".tpl-section-wrapper").attributes("style")).toContain(
      'background-image: url("blob:band.jpg")',
    );
    // The display URL never enters the content model.
    expect(block.backgroundImage?.url).toBe("hero.jpg");
    expect(block.wrapper?.backgroundImage?.url).toBe("band.jpg");
  });

  it("marks the box and the frame as dark-preview photo hosts, with the painted url", async () => {
    const wrapper = mountWrapper(
      sectionWithImages(),
      createImageUrlResolver((src) => `blob:${src}`),
    );
    await flushPromises();

    const box = wrapper.get(".tpl-block-content");
    expect(box.classes()).toContain("tpl-has-bg-image");
    expect(box.attributes("style")).toContain(
      '--tpl-block-bg-layer: url("blob:hero.jpg") center center / cover no-repeat',
    );
    const frame = wrapper.get(".tpl-section-wrapper");
    expect(frame.classes()).toContain("tpl-has-bg-image");
    expect(frame.attributes("style")).toContain(
      '--tpl-block-bg-layer: url("blob:band.jpg") center center / cover no-repeat',
    );
  });

  it("paints the stored urls when no resolver is configured", () => {
    const wrapper = mountWrapper(sectionWithImages());

    expect(wrapper.get(".tpl-block-content").attributes("style")).toContain(
      'background-image: url("hero.jpg")',
    );
    expect(wrapper.get(".tpl-section-wrapper").attributes("style")).toContain(
      'background-image: url("band.jpg")',
    );
  });

  it("never resolves nor paints a merge-tag image, box or wrapper frame", async () => {
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const block = createSectionBlock({
      backgroundImage: createBackgroundImage("*|HERO|*"),
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundColor: "#0f172a",
      },
      wrapper: {
        backgroundImage: createBackgroundImage("*|BAND|*"),
        backgroundColor: "#1e293b",
      },
    });
    // Mailchimp tags: happy-dom discards a `url("{{ … }}")` declaration on its
    // own, which would make the absence assertions below vacuous for liquid.
    const wrapper = mountWrapper(block, createImageUrlResolver(resolve), {
      [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.mailchimp,
    });
    await flushPromises();

    const box = wrapper.get(".tpl-block-content").attributes("style");
    expect(box).not.toContain("background-image");
    // The fallback colour still shows.
    expect(box).toContain("background-color: #0f172a");
    const frame = wrapper.get(".tpl-section-wrapper").attributes("style");
    expect(frame).not.toContain("background-image");
    expect(frame).toContain("background-color: #1e293b");
    expect(resolve).not.toHaveBeenCalled();
    // Nothing for the dark preview's photo layer to paint either.
    expect(box).not.toContain("--tpl-block-bg-layer");
    expect(frame).not.toContain("--tpl-block-bg-layer");
    expect(wrapper.get(".tpl-block-content").classes()).not.toContain(
      "tpl-has-bg-image",
    );
    expect(wrapper.get(".tpl-section-wrapper").classes()).not.toContain(
      "tpl-has-bg-image",
    );
  });

  it("paints no image on a section without one", () => {
    const wrapper = mountWrapper(createSectionBlock());

    expect(wrapper.get(".tpl-block-content").attributes("style")).not.toContain(
      "background-image",
    );
    expect(wrapper.get(".tpl-block-content").classes()).not.toContain(
      "tpl-has-bg-image",
    );
  });
});
