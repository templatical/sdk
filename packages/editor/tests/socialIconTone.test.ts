// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import {
  SOCIAL_ICON_GLYPHS,
  SOCIAL_ICON_TONE_COLORS,
  type SocialIconTone,
  type SocialIconStyle,
} from "@templatical/types";
import SocialIconSvg from "../src/components/blocks/SocialIconSvg.vue";
import SocialIconsBlock from "../src/components/blocks/SocialIconsBlock.vue";
import { mountEditor } from "./helpers/mount";
import { createSocialIconsBlock } from "@templatical/types";

/**
 * The canvas draws icons as CSS plus an inline SVG glyph; the renderer sends
 * PNGs. Both take their colors from `socialIconColors`, so these pin the
 * canvas side of each style and color against that shared rule.
 */

function draw(iconStyle: SocialIconStyle, iconTone?: SocialIconTone) {
  const wrapper = mount(SocialIconSvg, {
    props: { platform: "github", iconStyle, iconTone, iconSize: "medium" },
  });
  const box = wrapper.find("span").element as HTMLElement;
  const svg = wrapper.find("svg");
  return {
    background: box.style.backgroundColor,
    border: box.style.border,
    glyph: svg.attributes("fill"),
    glyphSize: svg.attributes("width"),
  };
}

/** A hex color as the DOM reports it back from an inline style. */
function css(hex: string): string {
  const el = document.createElement("span");
  el.style.backgroundColor = hex;
  return el.style.backgroundColor;
}

describe("SocialIconSvg colors", () => {
  it("keeps the brand look when no color is set", () => {
    expect(draw("circle")).toMatchObject({
      background: css(SOCIAL_ICON_GLYPHS.github.color),
      glyph: "#ffffff",
    });
    expect(draw("circle")).toEqual(draw("circle", "brand"));
  });

  it("fills a badge with the tone and keeps the glyph white", () => {
    expect(draw("rounded", "dark")).toMatchObject({
      background: css(SOCIAL_ICON_TONE_COLORS.dark),
      glyph: "#ffffff",
    });
  });

  it("puts a near-black glyph on a light badge", () => {
    expect(draw("solid", "light").glyph).toBe(SOCIAL_ICON_TONE_COLORS.dark);
  });

  it("draws an outline and its glyph in the tone", () => {
    const { border, glyph } = draw("outlined", "dark");
    expect(glyph).toBe(SOCIAL_ICON_TONE_COLORS.dark);
    const probe = document.createElement("span");
    probe.style.border = `2px solid ${SOCIAL_ICON_TONE_COLORS.dark}`;
    expect(border).toBe(probe.style.border);
  });

  it("draws a plain icon as a larger glyph in the tone, with no badge", () => {
    const plain = draw("plain", "light");
    expect(plain.background).toBe("");
    expect(plain.border).toBe("");
    expect(plain.glyph).toBe(SOCIAL_ICON_TONE_COLORS.light);
    // 84% of the 32px icon, against 60% inside a badge.
    expect(plain.glyphSize).toBe("26");
    expect(draw("circle").glyphSize).toBe("19");
  });
});

describe("SocialIconsBlock", () => {
  it("hands the block's tone to every icon it draws", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "github", url: "https://github.com" }],
      iconStyle: "plain",
      iconTone: "light",
    });
    const wrapper = mountEditor(SocialIconsBlock, {
      props: { block, viewport: "desktop" },
    });

    expect(wrapper.find("svg").attributes("fill")).toBe(
      SOCIAL_ICON_TONE_COLORS.light,
    );
  });
});
