import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createDividerBlock,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
} from "@templatical/types";
import { renderToMjml } from "../src";

const breakout =
  '#fff"><mj-raw><img src=x onerror=alert(1)></mj-raw><mj-section x="';
const escapedBreakout =
  "#fff&quot;&gt;&lt;mj-raw&gt;&lt;img src=x onerror=alert(1)&gt;&lt;/mj-raw&gt;&lt;mj-section x=&quot;";

describe("template values in MJML attributes", () => {
  it("uses a safe body background for markup and preserves a valid colour", async () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = breakout;

    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain('background-color="transparent"');
    expect(mjml).not.toContain("<mj-raw><img");

    content.settings.backgroundColor = "#ffffff";
    expect(await renderToMjml(content)).toContain(
      '<mj-body width="600px" background-color="#ffffff">',
    );
  });

  it("does not compile a breakout colour into an HTML image when HTML blocks are disabled", async () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = breakout;

    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    const html = (await mjml2html(mjml)).html;

    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });

  it("keeps a container background colour inside the paragraph attribute", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({
        content: "<p>Safe text</p>",
        styles: { backgroundColor: breakout },
      }),
    ];

    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain(`container-background-color="${escapedBreakout}"`);
    expect(mjml).not.toContain("<mj-raw><img");
  });

  it("keeps a native section background colour inside its attribute", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({ styles: { backgroundColor: breakout } }),
    ];

    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain(`background-color="${escapedBreakout}"`);
    expect(mjml).not.toContain("<mj-raw><img");
  });

  it("keeps a divider border style inside its attribute", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createDividerBlock({ lineStyle: `solid" data-unsafe="yes` as "solid" }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain('border-style="solid&quot; data-unsafe=&quot;yes"');
  });

  it("keeps social icon source parts inside their attribute", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [
          {
            platform: `facebook" data-unsafe="yes` as "facebook",
            url: "https://example.com",
          },
        ],
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain('/facebook&quot; data-unsafe=&quot;yes.png"');
  });

  it("keeps image alignment and padding inside their attributes", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: "https://example.com/image.png",
        alt: "Image",
        align: `left" data-unsafe="yes` as "left",
        styles: {
          padding: {
            top: `0" data-unsafe="yes` as unknown as number,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain('align="left&quot; data-unsafe=&quot;yes"');
    expect(mjml).toContain(
      'padding="0&quot; data-unsafe=&quot;yespx 0px 0px 0px"',
    );
  });

  it("keeps a spacer height from untrusted JSON inside its attribute", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSpacerBlock({
        height: `24" data-unsafe="yes` as unknown as number,
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain('height="24&quot; data-unsafe=&quot;yespx"');
  });
});
