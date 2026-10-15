// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";
import {
  createBackgroundImage,
  createSectionBlock,
  type SectionBlock,
} from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import { IMAGE_URL_RESOLVER_KEY } from "../src/keys";
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
) {
  return mountEditor(BlockWrapper, {
    props: {
      block,
      isSelected: false,
      viewport: "desktop" as const,
      previewMode: false,
    },
    slots: { default: () => h("div", "child") },
    provides: resolver ? { [IMAGE_URL_RESOLVER_KEY]: resolver } : {},
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

  it("paints the stored urls when no resolver is configured", () => {
    const wrapper = mountWrapper(sectionWithImages());

    expect(wrapper.get(".tpl-block-content").attributes("style")).toContain(
      'background-image: url("hero.jpg")',
    );
    expect(wrapper.get(".tpl-section-wrapper").attributes("style")).toContain(
      'background-image: url("band.jpg")',
    );
  });

  it("paints no image on a section without one", () => {
    const wrapper = mountWrapper(createSectionBlock());

    expect(wrapper.get(".tpl-block-content").attributes("style")).not.toContain(
      "background-image",
    );
  });
});
