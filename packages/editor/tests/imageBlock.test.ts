// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { SYNTAX_PRESETS, createImageBlock } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  IMAGE_URL_RESOLVER_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import ImageBlock from "../src/components/blocks/ImageBlock.vue";

function baseProvide() {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: [],
  };
}

describe("ImageBlock alignment (regression: #111)", () => {
  function mountImage(align: "left" | "center" | "right", width: number | "full") {
    const block = createImageBlock({
      src: "https://picsum.photos/600/400",
      width,
      align,
    });
    return mount(ImageBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("center alignment applies marginLeft: auto and marginRight: auto", () => {
    const wrapper = mountImage("center", 400);
    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("auto");
    expect(style.width).toBe("400px");
  });

  it("right alignment applies marginLeft: auto only", () => {
    const wrapper = mountImage("right", 400);
    const img = wrapper.find("img");
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("");
  });

  it("left alignment applies no auto margins", () => {
    const wrapper = mountImage("left", 400);
    const img = wrapper.find("img");
    const style = (img.element as HTMLElement).style;
    expect(style.marginLeft).toBe("");
    expect(style.marginRight).toBe("");
  });

  it("does not use the margin shorthand (prevents Vue's longhand-clear regression)", () => {
    const wrapper = mountImage("center", 400);
    const img = wrapper.find("img");
    const inline = img.attributes("style") ?? "";
    expect(inline).not.toMatch(/(^|;)\s*margin\s*:/);
  });
});

describe("ImageBlock display-only src resolution (#415)", () => {
  function mountWithResolver(
    blockOverrides: Parameters<typeof createImageBlock>[0],
    resolve: (src: string) => string | null | Promise<string | null>,
  ) {
    const block = createImageBlock(blockOverrides);
    const wrapper = mount(ImageBlock, {
      props: { block, viewport: "desktop" as const },
      global: {
        provide: {
          ...baseProvide(),
          [IMAGE_URL_RESOLVER_KEY as symbol]: createImageUrlResolver(resolve),
        },
      },
    });
    return { block, wrapper };
  }

  it("renders the resolved preview URL while block.src stays canonical", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { block, wrapper } = mountWithResolver({ src: "logo.png" }, resolve);

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe("blob:preview/logo.png");
    // Display-only: the content model and emitted updates are untouched.
    expect(block.src).toBe("logo.png");
    expect(wrapper.emitted("update")).toBe(undefined);
  });

  it("renders the resolved preview URL for a linked image", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { src: "logo.png", linkUrl: "https://example.com" },
      resolve,
    );

    await flushPromises();
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.find("img").attributes("src")).toBe("blob:preview/logo.png");
  });

  it("falls back to the canonical src when the resolver returns null", async () => {
    const resolve = vi.fn(async () => null);
    const { wrapper } = mountWithResolver(
      { src: "https://cdn.example.com/a.png" },
      resolve,
    );

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("never passes a merge-tag src to the resolver", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    mountWithResolver({ src: "{{ product.image }}" }, resolve);

    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();
  });

  it("resolves the placeholder preview for a merge-tag src", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { src: "{{ product.image }}", placeholderUrl: "placeholder.png" },
      resolve,
    );

    await flushPromises();
    expect(resolve).toHaveBeenCalledWith("placeholder.png");
    expect(resolve).not.toHaveBeenCalledWith("{{ product.image }}");
    expect(wrapper.find("img").attributes("src")).toBe(
      "blob:preview/placeholder.png",
    );
  });
});
