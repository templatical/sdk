import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createDefaultTemplateContent,
  createDividerBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
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

  it("keeps a colour to one CSS declaration", async () => {
    const content = createDefaultTemplateContent();
    content.settings.backgroundColor = "red;background-image:url(//x.test/a)";
    content.blocks = [
      createSectionBlock({
        styles: { backgroundColor: "blue; position:fixed" } as never,
      }),
    ];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      'background-color="redbackground-image:url(//x.test/a)"',
    );
    expect(mjml).toContain('background-color="blue position:fixed"');
    expect(mjml).not.toMatch(/background-color="[^"]*;/);
  });

  it("keeps crafted menu spacing and table sizes inside their CSS values", async () => {
    const content = createDefaultTemplateContent();
    const menu = createMenuBlock();
    const item = {
      url: "https://example.com",
      openInNewTab: false,
      bold: false,
      underline: false,
    };
    menu.items = [
      { ...item, id: "a", text: "A" },
      { ...item, id: "b", text: "B" },
    ];
    (menu as { spacing: unknown }).spacing = "1;position:fixed";
    const table = createTableBlock();
    (table as { borderWidth: unknown }).borderWidth = "1;position:fixed";
    (table as { cellPadding: unknown }).cellPadding = "2}x{color:red";
    content.blocks = [menu, table];

    const mjml = await renderToMjml(content);
    expect(mjml).toContain("padding: 0 1position:fixedpx;");
    expect(mjml).toContain("border: 1position:fixedpx solid");
    expect(mjml).toContain("padding: 2xcolor:redpx");
    expect(mjml).not.toContain("1;position:fixed");
    expect(mjml).not.toContain("2}x{color:red");
  });
});
