import { describe, expect, it } from "vitest";
import { createSocialIconsBlock } from "@templatical/types";
import {
  renderBlock,
  RenderContext,
  DEFAULT_SOCIAL_ICONS_BASE_URL,
} from "../src";

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

describe("renderSocialIcons", () => {
  it("returns empty string for hidden block", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "facebook", url: "https://facebook.com" }],
      visibility: { desktop: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe("");
  });

  it("returns empty string for empty icons array", () => {
    const block = createSocialIconsBlock({ icons: [] });
    const result = renderBlock(block, ctx);
    expect(result).toBe("");
  });

  it("renders basic social block with default medium icon size", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain("mj-social");
    expect(result).toContain('icon-size="32px"');
    expect(result).toContain('href="https://twitter.com"');
  });

  it("renders with small icon size", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconSize: "small",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('icon-size="24px"');
  });

  it("renders with large icon size", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconSize: "large",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('icon-size="48px"');
  });

  it("renders with circle icon style", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconStyle: "circle",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('border-radius="50%"');
  });

  it("renders with rounded icon style", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconStyle: "rounded",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('border-radius="8px"');
  });

  it("renders with square icon style", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconStyle: "square",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('border-radius="0"');
  });

  it("renders with solid icon style using default border radius", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconStyle: "solid",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('border-radius="4px"');
  });

  it("renders multiple icons with spacing applied as right padding", () => {
    const block = createSocialIconsBlock({
      icons: [
        { platform: "facebook", url: "https://facebook.com" },
        { platform: "twitter", url: "https://twitter.com" },
        { platform: "linkedin", url: "https://linkedin.com" },
      ],
      spacing: 12,
    });
    const result = renderBlock(block, ctx);
    // First two icons get right padding equal to spacing
    const rightPad12Count = (result.match(/padding="0 12px 0 0"/g) || [])
      .length;
    expect(rightPad12Count).toBe(2);
    // Last icon gets 0 right padding
    expect(result).toContain('padding="0 0px 0 0"');
  });

  it("renders alignment", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      align: "left",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('align="left"');
  });

  it("renders background color", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      styles: {
        backgroundColor: "#ff0000",
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
      },
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('container-background-color="#ff0000"');
  });

  it("emits PNG asset URL with style/platform path, not data URI", () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "facebook", url: "https://facebook.com" }],
      iconStyle: "circle",
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain(
      `src="${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/facebook.png"`,
    );
    expect(result).not.toContain("data:");
  });

  it("emits no inline SVG markup", () => {
    const block = createSocialIconsBlock({
      icons: [
        { platform: "facebook", url: "https://facebook.com" },
        { platform: "twitter", url: "https://twitter.com" },
      ],
      iconStyle: "circle",
    });
    const result = renderBlock(block, ctx);
    expect(result).not.toMatch(/<svg[\s>]/i);
    expect(result).not.toContain("</svg>");
    expect(result).not.toContain("xmlns=\"http://www.w3.org/2000/svg\"");
    expect(result).not.toContain("image/svg+xml");
  });

  it("default base URL points at version-pinned jsDelivr mirror", () => {
    expect(DEFAULT_SOCIAL_ICONS_BASE_URL).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@templatical\/renderer@\d+\.\d+\.\d+\/assets\/social$/,
    );
  });

  it("honors a custom socialIconsBaseUrl", () => {
    const custom = new RenderContext(
      600,
      [],
      "Arial, sans-serif",
      true,
      new Map(),
      "https://cdn.example.com/icons",
    );
    const block = createSocialIconsBlock({
      icons: [{ platform: "twitter", url: "https://twitter.com" }],
      iconStyle: "rounded",
    });
    const result = renderBlock(block, custom);
    expect(result).toContain(
      'src="https://cdn.example.com/icons/rounded/twitter.png"',
    );
  });

  it("emits URL for every supported platform and style", () => {
    const platforms = [
      "facebook",
      "twitter",
      "instagram",
      "linkedin",
      "youtube",
      "tiktok",
      "pinterest",
      "email",
      "whatsapp",
      "telegram",
      "discord",
      "snapchat",
      "reddit",
      "github",
      "dribbble",
      "behance",
    ] as const;
    const styles = [
      "solid",
      "outlined",
      "rounded",
      "square",
      "circle",
    ] as const;

    for (const style of styles) {
      for (const platform of platforms) {
        const block = createSocialIconsBlock({
          icons: [{ platform, url: `https://${platform}.example` }],
          iconStyle: style,
        });
        const result = renderBlock(block, ctx);
        expect(result).toContain(
          `src="${DEFAULT_SOCIAL_ICONS_BASE_URL}/${style}/${platform}.png"`,
        );
      }
    }
  });

  it("escapes special characters in URL href", () => {
    const block = createSocialIconsBlock({
      icons: [
        {
          platform: "website",
          url: "https://example.com/path?a=1&b=2",
        },
      ],
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain("href=\"https://example.com/path?a=1&amp;b=2\"");
  });
});
