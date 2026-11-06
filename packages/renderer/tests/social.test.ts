import { describe, expect, it } from "vitest";
import nodeMjml from "mjml";
import {
  createSocialIconsBlock,
  SOCIAL_ICON_TONES,
  SOCIAL_ICON_STYLES,
  type SocialIconTone,
} from "@templatical/types";
import {
  renderBlock,
  RenderContext,
  DEFAULT_SOCIAL_ICONS_BASE_URL,
} from "../src";

type CompileOptions = {
  minify?: boolean;
  beautify?: boolean;
};

type Mjml2Html = (
  source: string,
  options?: CompileOptions,
) => Promise<{ html: string; errors: unknown[] }>;

function resolveCompiler(value: unknown): Mjml2Html | undefined {
  if (typeof value === "function") return value as Mjml2Html;
  if (!value || typeof value !== "object") return undefined;
  const record = value as { default?: unknown; mjml?: unknown };
  return resolveCompiler(record.default) ?? resolveCompiler(record.mjml);
}

const browserMjml: Promise<Mjml2Html> = import("mjml-browser").then((mod) => {
  const compile = resolveCompiler(mod);
  if (!compile) throw new Error("mjml-browser did not export a compiler");
  return compile;
});

function wrapSocial(blockMjml: string): string {
  return `<mjml><mj-body><mj-section><mj-column>${blockMjml}</mj-column></mj-section></mj-body></mjml>`;
}

function xingImage(html: string): { src: string; alt: string } {
  const tag = html
    .match(/<img\b[^>]*>/g)
    ?.find((candidate) => candidate.includes("/xing.png"));
  if (!tag) throw new Error("compiled HTML has no Xing img");
  const src = tag.match(/\bsrc="([^"]*)"/)?.[1];
  const alt = tag.match(/\balt="([^"]*)"/)?.[1];
  if (src === undefined || alt === undefined) {
    throw new Error(`Xing img is missing src or alt: ${tag}`);
  }
  return { src, alt };
}

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
    expect(result).not.toContain('xmlns="http://www.w3.org/2000/svg"');
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
      "xing",
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
    for (const style of SOCIAL_ICON_STYLES) {
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

  it("puts a one-tone color in its own folder and keeps brand URLs as they were", () => {
    const srcFor = (iconTone: SocialIconTone | undefined) =>
      renderBlock(
        createSocialIconsBlock({
          icons: [{ platform: "github", url: "https://github.com" }],
          iconStyle: "circle",
          iconTone,
        }),
        ctx,
      ).match(/src="([^"]+)"/)![1];

    expect(srcFor(undefined)).toBe(
      `${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/github.png`,
    );
    for (const color of SOCIAL_ICON_TONES) {
      const dir = color === "brand" ? "circle" : `circle-${color}`;
      expect(srcFor(color)).toBe(
        `${DEFAULT_SOCIAL_ICONS_BASE_URL}/${dir}/github.png`,
      );
    }
    // A tampered value can't point at a folder the build never wrote.
    for (const tampered of ["neon", "constructor", "__proto__"]) {
      expect(srcFor(tampered as SocialIconTone)).toBe(
        `${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/github.png`,
      );
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
    expect(result).toContain('href="https://example.com/path?a=1&amp;b=2"');
  });

  it("compiles a Xing icon to the same img src and alt in mjml and mjml-browser", async () => {
    const block = createSocialIconsBlock({
      icons: [{ platform: "xing", url: "https://www.xing.com/pages/example" }],
      iconStyle: "circle",
    });
    const mjml = renderBlock(block, ctx);
    const src = `${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/xing.png`;
    expect(mjml).toContain("<mj-social-element");
    expect(mjml).toContain(`src="${src}"`);
    expect(mjml).toContain('href="https://www.xing.com/pages/example"');

    const source = wrapSocial(mjml);
    const nodeResult = await nodeMjml(source);
    const browserResult = await (await browserMjml)(source);
    expect(nodeResult.errors).toEqual([]);
    expect(browserResult.errors).toEqual([]);

    const nodeImage = xingImage(nodeResult.html);
    const browserImage = xingImage(browserResult.html);
    expect(browserImage).toEqual(nodeImage);
    expect(nodeImage.src).toBe(src);
    expect(nodeImage.alt).toBe("");
  });
});
