// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  createBackgroundImage,
  createSectionBlock,
  createTitleBlock,
  createWrapperBlock,
  type Block,
} from "@templatical/types";
import WrapperBlock from "../src/components/blocks/WrapperBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { BLOCK_REGISTRY_KEY, IMAGE_URL_RESOLVER_KEY } from "../src/keys";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import { mountEditor } from "./helpers/mount";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";

function titleRegistry() {
  return {
    getComponent: vi.fn((block: Block) =>
      block.type === "title" ? TitleBlock : undefined,
    ),
  } as unknown as UseBlockRegistryReturn;
}

describe("WrapperBlock", () => {
  it("paints the band background and shows child text", () => {
    const title = createTitleBlock({
      content: "<p>Card body</p>",
      level: 2,
    });
    const block = createWrapperBlock({
      styles: {
        backgroundColor: "#ffffff",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
      borderRadius: 12,
      children: [title],
    });
    const registry = titleRegistry();

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: { [BLOCK_REGISTRY_KEY]: registry },
    });

    const root = wrapper.get('[data-testid="layout-wrapper"]');
    expect(root.attributes("style")).toContain("background-color: #ffffff");
    // Equal sides serialize as the CSS shorthand `padding: 24px`.
    expect(root.attributes("style")).toContain("padding: 24px");
    expect(root.attributes("style")).toContain("border-radius: 12px");
    expect(root.text()).toBe("Card body");
    expect(registry.getComponent).toHaveBeenCalledWith(title);
    expect(wrapper.get(`[data-block-id="${title.id}"]`).exists()).toBe(true);
  });
});

describe("WrapperBlock background images", () => {
  it("paints the band image through resolveImageUrl", async () => {
    const resolver = createImageUrlResolver((src) => `blob:${src}`);
    const block = createWrapperBlock({
      backgroundImage: createBackgroundImage("band.jpg"),
      children: [],
    });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: resolver,
      },
    });
    await flushPromises();

    expect(
      wrapper.get('[data-testid="layout-wrapper"]').attributes("style"),
    ).toContain('background-image: url("blob:band.jpg")');
  });

  it("paints a child section's image from the resolver cache", async () => {
    const resolver = createImageUrlResolver((src) => `blob:${src}`);
    resolver.lookup("hero.jpg");
    await flushPromises();
    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("hero.jpg"),
    });
    const block = createWrapperBlock({ children: [section] });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: resolver,
      },
    });

    expect(
      wrapper.get(`[data-block-id="${section.id}"]`).attributes("style"),
    ).toContain('background-image: url("blob:hero.jpg")');
  });
});
