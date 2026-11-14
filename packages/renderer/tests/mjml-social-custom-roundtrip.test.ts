import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createSocialIconsBlock,
  type SocialIconSize,
} from "@templatical/types";
import { renderToMjml, DEFAULT_SOCIAL_ICONS_BASE_URL } from "../src";

/**
 * Compiles renderer MJML through mjml@5. Attribute presence on the MJML is
 * not enough: MJML's social network palette fills `name` defaults such as
 * Facebook's `#3b5998` background, and the icon size lands on the compiled
 * `<img>` width plus the icon cell's width and height.
 */

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function iconTable(html: string, src: string): { img: string; table: string } {
  const img = html
    .match(/<img\b[^>]*>/g)
    ?.find((tag) => tag.includes(`src="${src}"`));
  if (!img) throw new Error(`compiled HTML has no img for ${src}`);
  const imgAt = html.indexOf(img);
  const tableAt = html.lastIndexOf("<table", imgAt);
  const tableEnd = html.indexOf("</table>", imgAt);
  return { img, table: html.slice(tableAt, tableEnd) };
}

const SIZES: Record<SocialIconSize, number> = {
  small: 24,
  medium: 32,
  large: 48,
};

describe("custom social icons through the MJML compiler", () => {
  it.each(Object.entries(SIZES) as [SocialIconSize, number][])(
    "compiles a %s custom icon at %ipx with no network background",
    async (iconSize, px) => {
      const src = "https://cdn.example/mastodon.png";
      const href = "https://example.com/mastodon?a=1&b=2";
      const block = createSocialIconsBlock({
        icons: [
          {
            id: "fb",
            platform: "facebook",
            url: "https://facebook.com/acme",
          },
          {
            id: "md",
            platform: "custom",
            url: href,
            imageUrl: src,
            alt: "A & B",
          },
        ],
        iconSize,
        iconStyle: "circle",
      });
      const content = createDefaultTemplateContent();
      content.blocks = [block];
      const mjml = await renderToMjml(content);
      expect(mjml).toContain(`src="${src}"`);
      expect(mjml).toContain('alt="A &amp; B"');
      expect(mjml).toContain('border-radius="0"');
      expect(mjml).not.toMatch(/\bname="/);
      expect(mjml).toContain(
        `src="${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/facebook.png"`,
      );

      const html = await compile(mjml);
      const custom = iconTable(html, src);
      expect(custom.img).toContain('alt="A &amp; B"');
      expect(custom.img).toContain(`width="${px}"`);
      expect(custom.img).toContain("border-radius:0");
      expect(custom.table).toContain(`height:${px}px`);
      expect(custom.table).toContain(`width:${px}px`);
      expect(custom.table).toContain("background:transparent");
      expect(custom.table).toContain(
        'href="https://example.com/mastodon?a=1&amp;b=2"',
      );
      expect(custom.table).not.toContain("#3b5998");
      expect(html).toContain(
        `${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/facebook.png`,
      );
      expect(html).not.toContain("#3b5998");
    },
  );
});
