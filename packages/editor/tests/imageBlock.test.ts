// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { SYNTAX_PRESETS, createImageBlock } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
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
