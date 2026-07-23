// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { SYNTAX_PRESETS, createVideoBlock } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  IMAGE_URL_RESOLVER_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { createImageUrlResolver } from "../src/composables/useImageUrlResolver";
import VideoPlayButton from "../src/components/blocks/VideoPlayButton.vue";
import VideoBlock from "../src/components/blocks/VideoBlock.vue";

function baseProvide() {
  return {
    [TRANSLATIONS_KEY as symbol]: enTranslations,
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [MERGE_TAGS_KEY as symbol]: [],
  };
}

describe("VideoPlayButton", () => {
  it("renders an SVG play triangle", () => {
    const wrapper = mount(VideoPlayButton);
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
    const polygon = svg.find("polygon");
    expect(polygon.attributes("points")).toBe("5,3 19,12 5,21");
  });

  it("does not apply the hover-transition class by default", () => {
    const wrapper = mount(VideoPlayButton);
    const outer = wrapper.find("div");
    expect(outer.classes()).not.toContain("tpl:transition-opacity");
  });

  it("applies the hover-transition class when hoverEffect=true", () => {
    const wrapper = mount(VideoPlayButton, {
      props: { hoverEffect: true },
    });
    const outer = wrapper.find("div");
    expect(outer.classes()).toContain("tpl:transition-opacity");
  });
});

describe("VideoBlock alignment (regression: #111)", () => {
  function mountVideo(align: "left" | "center" | "right", width: number | "full") {
    const block = createVideoBlock({
      url: "https://www.youtube.com/watch?v=8vO7dKj7CFs",
      thumbnailUrl: "https://img.youtube.com/vi/8vO7dKj7CFs/maxresdefault.jpg",
      width,
      align,
    });
    return mount(VideoBlock, {
      props: { block, viewport: "desktop" },
      global: { provide: baseProvide() },
    });
  }

  it("center alignment applies marginLeft: auto and marginRight: auto", () => {
    const wrapper = mountVideo("center", 400);
    const anchor = wrapper.find("a");
    expect(anchor.exists()).toBe(true);
    const style = (anchor.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("auto");
    expect(style.width).toBe("400px");
  });

  it("right alignment applies marginLeft: auto only", () => {
    const wrapper = mountVideo("right", 400);
    const anchor = wrapper.find("a");
    const style = (anchor.element as HTMLElement).style;
    expect(style.marginLeft).toBe("auto");
    expect(style.marginRight).toBe("");
  });

  it("left alignment applies no auto margins", () => {
    const wrapper = mountVideo("left", 400);
    const anchor = wrapper.find("a");
    const style = (anchor.element as HTMLElement).style;
    expect(style.marginLeft).toBe("");
    expect(style.marginRight).toBe("");
  });

  it("does not use the margin shorthand (prevents Vue's longhand-clear regression)", () => {
    const wrapper = mountVideo("center", 400);
    const anchor = wrapper.find("a");
    const inline = anchor.attributes("style") ?? "";
    expect(inline).not.toMatch(/(^|;)\s*margin\s*:/);
  });
});

describe("VideoBlock display-only thumbnail resolution (#415)", () => {
  function mountWithResolver(
    blockOverrides: Parameters<typeof createVideoBlock>[0],
    resolve: (src: string) => string | null | Promise<string | null>,
  ) {
    const block = createVideoBlock(blockOverrides);
    const wrapper = mount(VideoBlock, {
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

  it("renders the resolved preview for an explicit thumbnailUrl while the block stays canonical", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { block, wrapper } = mountWithResolver(
      {
        url: "https://www.youtube.com/watch?v=8vO7dKj7CFs",
        thumbnailUrl: "thumb.png",
      },
      resolve,
    );

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe("blob:preview/thumb.png");
    expect(block.thumbnailUrl).toBe("thumb.png");
  });

  it("never passes an auto-derived provider thumbnail to the resolver", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { url: "https://www.youtube.com/watch?v=8vO7dKj7CFs" },
      resolve,
    );

    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();
    // The derived provider thumbnail is already a real URL — displayed as-is.
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://img.youtube.com/vi/8vO7dKj7CFs/maxresdefault.jpg",
    );
  });

  it("falls back to the canonical thumbnailUrl when the resolver returns null", async () => {
    const resolve = vi.fn(async () => null);
    const { wrapper } = mountWithResolver(
      {
        url: "https://www.youtube.com/watch?v=8vO7dKj7CFs",
        thumbnailUrl: "https://cdn.example.com/thumb.png",
      },
      resolve,
    );

    await flushPromises();
    expect(wrapper.find("img").attributes("src")).toBe(
      "https://cdn.example.com/thumb.png",
    );
  });

  it("resolves the placeholder preview for a merge-tag video url", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    const { wrapper } = mountWithResolver(
      { url: "{{ video.url }}", placeholderUrl: "placeholder.png" },
      resolve,
    );

    await flushPromises();
    expect(resolve).toHaveBeenCalledWith("placeholder.png");
    expect(resolve).not.toHaveBeenCalledWith("{{ video.url }}");
    expect(wrapper.find("img").attributes("src")).toBe(
      "blob:preview/placeholder.png",
    );
  });

  it("never passes a merge-tag thumbnailUrl to the resolver", async () => {
    const resolve = vi.fn(async (src: string) => `blob:preview/${src}`);
    mountWithResolver(
      {
        url: "https://www.youtube.com/watch?v=8vO7dKj7CFs",
        thumbnailUrl: "{{ video.thumb }}",
      },
      resolve,
    );

    await flushPromises();
    expect(resolve).not.toHaveBeenCalled();
  });
});
