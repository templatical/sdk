// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  SYNTAX_PRESETS,
  createBackgroundImage,
  createSectionBlock,
  createTitleBlock,
  createWrapperBlock,
  type Block,
} from "@templatical/types";
import WrapperBlock from "../src/components/blocks/WrapperBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import {
  BLOCK_REGISTRY_KEY,
  IMAGE_URL_RESOLVER_KEY,
  MERGE_TAG_SYNTAX_KEY,
} from "../src/keys";
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

  it("looks up a child section's image itself and paints the resolved url", async () => {
    const resolve = vi.fn(async (src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
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
    await flushPromises();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("hero.jpg");
    expect(
      wrapper.get(`[data-block-id="${section.id}"]`).attributes("style"),
    ).toContain('background-image: url("blob:hero.jpg")');
  });

  it("looks up only section images among mixed children", async () => {
    const resolve = vi.fn(async (src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const title = createTitleBlock({ content: "<p>Card body</p>", level: 2 });
    const plain = createSectionBlock();
    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("hero.jpg"),
    });
    const block = createWrapperBlock({ children: [title, plain, section] });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: resolver,
      },
    });
    await flushPromises();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith("hero.jpg");
    expect(
      wrapper.get(`[data-block-id="${plain.id}"]`).attributes("style"),
    ).not.toContain("background-image");
    expect(
      wrapper.get(`[data-block-id="${section.id}"]`).attributes("style"),
    ).toContain('background-image: url("blob:hero.jpg")');
  });

  it("marks the band and each child box that paints an image as dark-preview photo hosts", async () => {
    const resolver = createImageUrlResolver((src) => `blob:${src}`);
    const title = createTitleBlock({ content: "<p>Card body</p>", level: 2 });
    const plain = createSectionBlock();
    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("hero.jpg"),
    });
    const block = createWrapperBlock({
      backgroundImage: createBackgroundImage("band.jpg"),
      children: [title, plain, section],
    });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: resolver,
      },
    });
    await flushPromises();

    const band = wrapper.get('[data-testid="layout-wrapper"]');
    expect(band.classes()).toContain("tpl-has-bg-image");
    expect(band.attributes("style")).toContain(
      '--tpl-block-bg-layer: url("blob:band.jpg") center center / cover no-repeat',
    );
    const box = wrapper.get(`[data-block-id="${section.id}"]`);
    expect(box.classes()).toContain("tpl-has-bg-image");
    expect(box.attributes("style")).toContain(
      '--tpl-block-bg-layer: url("blob:hero.jpg") center center / cover no-repeat',
    );
    for (const child of [title, plain]) {
      expect(
        wrapper.get(`[data-block-id="${child.id}"]`).classes(),
      ).not.toContain("tpl-has-bg-image");
    }
  });

  it("looks up the image of a section added to the band later", async () => {
    const resolve = vi.fn(async (src: string) => `blob:${src}`);
    const resolver = createImageUrlResolver(resolve);
    const wrapper = mountEditor(WrapperBlock, {
      props: { block: createWrapperBlock({ children: [] }), viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: resolver,
      },
    });
    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();

    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("late.jpg"),
    });
    await wrapper.setProps({
      block: createWrapperBlock({ children: [section] }),
    });
    await flushPromises();

    expect(resolve).toHaveBeenCalledWith("late.jpg");
    expect(
      wrapper.get(`[data-block-id="${section.id}"]`).attributes("style"),
    ).toContain('background-image: url("blob:late.jpg")');
  });

  // Mailchimp tags below: happy-dom discards a `url("{{ … }}")` declaration on
  // its own, which would make the absence assertions vacuous for liquid.
  it("never resolves nor paints a merge-tag band image", async () => {
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const block = createWrapperBlock({
      styles: {
        backgroundColor: "#0f172a",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      backgroundImage: createBackgroundImage("*|HERO|*"),
      children: [],
    });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver(resolve),
        [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.mailchimp,
      },
    });
    await flushPromises();

    const style = wrapper
      .get('[data-testid="layout-wrapper"]')
      .attributes("style");
    expect(style).not.toContain("background-image");
    expect(style).toContain("background-color: #0f172a");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("never resolves nor paints a child section's merge-tag image", async () => {
    const resolve = vi.fn((src: string) => `blob:${src}`);
    const section = createSectionBlock({
      backgroundImage: createBackgroundImage("*|HERO|*"),
      styles: {
        backgroundColor: "#0f172a",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    const block = createWrapperBlock({ children: [section] });

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: {
        [BLOCK_REGISTRY_KEY]: titleRegistry(),
        [IMAGE_URL_RESOLVER_KEY]: createImageUrlResolver(resolve),
        [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.mailchimp,
      },
    });
    await flushPromises();

    const style = wrapper
      .get(`[data-block-id="${section.id}"]`)
      .attributes("style");
    expect(style).not.toContain("background-image");
    expect(style).toContain("background-color: #0f172a");
    expect(resolve).not.toHaveBeenCalled();
  });
});
