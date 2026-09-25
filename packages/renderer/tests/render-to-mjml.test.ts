import { describe, expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  createSectionBlock,
  createImageBlock,
  createSocialIconsBlock,
  createSlotBlock,
  createWrapperBlock,
  type Block,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml, DEFAULT_SOCIAL_ICONS_BASE_URL } from "../src";

const SLOT_IN_CONTENT = "[Templatical] slot is not a valid content block";
const WRAPPER_IN_CONTENT = "[Templatical] wrapper is not a valid content block";
const NESTED_MJ_WRAPPER =
  "[Templatical] layout: a wrapper around the slot cannot contain blocks that emit mj-wrapper (section.wrapper)";

function withBlocks(
  blocks: Block[],
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  if (settings) {
    content.settings = { ...content.settings, ...settings };
  }
  return content;
}

function siblingLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createTitleBlock({ content: "<p>View in browser</p>" }),
      createSlotBlock(),
      createParagraphBlock({ content: "<p>Impressum</p>" }),
    ],
    settings,
  );
}

function cardLayout(
  settings?: Partial<TemplateContent["settings"]>,
): TemplateContent {
  return withBlocks(
    [
      createTitleBlock({ content: "<p>View in browser</p>" }),
      createWrapperBlock({
        styles: {
          backgroundColor: "#ffffff",
          padding: { top: 24, right: 24, bottom: 24, left: 24 },
        },
        borderRadius: 12,
        children: [createSlotBlock()],
      }),
      createParagraphBlock({ content: "<p>Impressum</p>" }),
    ],
    settings,
  );
}

describe("renderToMjml", () => {
  it("renders empty template", async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
    expect(mjml).toContain("</mjml>");
    expect(mjml).toContain("<mj-body");
    expect(mjml).toContain('width="600px"');
    expect(mjml).toContain('background-color="#ffffff"');
    expect(mjml).toContain('font-family="Arial, sans-serif"');
  });

  it("emits the document textColor default (#1a1a1a) on the mj-text default", async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-text font-size="14px" color="#1a1a1a" />');
  });

  it("omits the mj-text default color for legacy content without textColor", async () => {
    const content = createDefaultTemplateContent();
    // Simulate a template stored before textColor existed — the renderer still
    // omits the color rather than emitting `color="undefined"`.
    delete (content.settings as { textColor?: string }).textColor;
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-text font-size="14px" />');
  });

  it("emits textColor as the mj-text default color when set", async () => {
    const content = createDefaultTemplateContent();
    content.settings.textColor = "#336699";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mj-text font-size="14px" color="#336699" />');
  });

  it("lets a Title keep its own color over the document textColor", async () => {
    const content = createDefaultTemplateContent();
    content.settings.textColor = "#336699";
    content.blocks = [
      createTitleBlock({ content: "<p>Hi</p>", color: "#1a1a1a" }),
    ];
    const mjml = await renderToMjml(content);
    // Document default lands on the mj-attributes <mj-text> default...
    expect(mjml).toContain('<mj-text font-size="14px" color="#336699" />');
    // ...while the Title emits its own color, overriding the default.
    expect(mjml).toContain('color="#1a1a1a"');
  });

  it("renders blocks inside body", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: "<p>Hello World</p>" })];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("Hello World");
    expect(mjml).toContain("<mj-text");
  });

  it("wraps non-section blocks in section/column", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: "<p>Test</p>" })];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("<mj-section>");
    expect(mjml).toContain("<mj-column>");
  });

  it("renders section blocks directly", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        children: [[createParagraphBlock({ content: "<p>In section</p>" })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("In section");
  });

  it("emits border-radius on a section when set", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        borderRadius: 12,
        children: [[createParagraphBlock({ content: "<p>Card</p>" })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('border-radius="12px"');
  });

  it("omits border-radius on a section when zero", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        borderRadius: 0,
        children: [[createParagraphBlock({ content: "<p>x</p>" })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).not.toContain("border-radius");
  });

  it("wraps a section in mj-wrapper (with bg/padding/radius) when section.wrapper is set", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        wrapper: {
          backgroundColor: "#0000ff",
          padding: { top: 24, right: 20, bottom: 24, left: 20 },
          borderRadius: 8,
        },
        children: [[createParagraphBlock({ content: "<p>Card</p>" })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("<mj-wrapper");
    expect(mjml).toContain('background-color="#0000ff"');
    expect(mjml).toContain('padding="24px 20px 24px 20px"');
    expect(mjml).toContain('border-radius="8px"');
    // The section's mj-section must sit INSIDE the wrapper.
    const inside = mjml.slice(
      mjml.indexOf("<mj-wrapper"),
      mjml.indexOf("</mj-wrapper>"),
    );
    expect(inside).toContain("<mj-section");
  });

  it("does not emit mj-wrapper when the section has no wrapper", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        children: [[createParagraphBlock({ content: "<p>x</p>" })]],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).not.toContain("<mj-wrapper");
  });

  it("adds preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "Check this out!";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("<mj-preview>Check this out!</mj-preview>");
  });

  it("adds custom font declarations", async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content, {
      customFonts: [
        { name: "Inter", url: "https://fonts.example.com/inter.css" },
      ],
    });
    expect(mjml).toContain(
      '<mj-font name="Inter" href="https://fonts.example.com/inter.css"',
    );
  });

  it("includes visibility media queries", async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("tpl-hide-mobile");
    expect(mjml).toContain("tpl-hide-desktop");
    expect(mjml).not.toContain("tpl-hide-tablet");
  });

  it("wraps blocks with display conditions", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({
        content: "<p>Conditional</p>",
        displayCondition: {
          label: "VIP",
          before: "{% if vip %}",
          after: "{% endif %}",
        },
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("<mj-raw>{% if vip %}</mj-raw>");
    expect(mjml).toContain("<mj-raw>{% endif %}</mj-raw>");
    expect(mjml).toContain("Conditional");
  });

  it("wraps display conditions on blocks nested inside a section column", async () => {
    const content = createDefaultTemplateContent();
    const conditional = createParagraphBlock({
      content: "<p>VIP only</p>",
      displayCondition: {
        label: "VIP",
        before: "{% if vip %}",
        after: "{% endif %}",
      },
    });
    const section = createSectionBlock({
      columns: "2",
      children: [
        [conditional],
        [createParagraphBlock({ content: "<p>Everyone</p>" })],
      ],
    });
    content.blocks = [section];

    const mjml = await renderToMjml(content);

    // The nested block must emit the same liquid guards as a top-level block;
    // otherwise conditional content inside a multi-column layout renders
    // unconditionally for every recipient.
    expect(mjml).toContain("<mj-raw>{% if vip %}</mj-raw>");
    expect(mjml).toContain("<mj-raw>{% endif %}</mj-raw>");
    expect(mjml).toContain("VIP only");
    // The non-conditional sibling stays ungated.
    expect(mjml).toContain("Everyone");
  });

  it("filters html blocks when not allowed", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ content: "<p>Keep</p>" }),
      {
        id: "1",
        type: "html" as const,
        content: "<div>Remove</div>",
        styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      },
    ];
    const mjml = await renderToMjml(content, { allowHtmlBlocks: false });
    expect(mjml).toContain("Keep");
    expect(mjml).not.toContain("Remove");
  });

  it("renders with width=0", async () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 0;
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('width="0px"');
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
  });

  it("renders with very large width", async () => {
    const content = createDefaultTemplateContent();
    content.settings.width = 9999;
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('width="9999px"');
  });

  it("renders with empty blocks array", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
    expect(mjml).toContain("<mj-body");
    expect(mjml).toContain("</mj-body>");
    expect(mjml).toContain("</mjml>");
    // <mj-attributes> may contain `<mj-text font-size="..." />` defaults
    // — assert only on the body.
    const body = mjml.replace(/<mj-attributes>[\s\S]*?<\/mj-attributes>/, "");
    expect(body).not.toContain("<mj-text");
  });

  it("does not add preview tag for empty preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
    expect(mjml).toContain("<mj-body");
    expect(mjml).not.toContain("<mj-preview>");
  });

  it("does not add preview tag for whitespace-only preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "   ";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
    expect(mjml).toContain("<mj-body");
    expect(mjml).not.toContain("<mj-preview>");
  });

  it("trims preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "  Hello World  ";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("<mj-preview>Hello World</mj-preview>");
  });

  it("escapes HTML in preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "Sale <50% off> & more";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      "<mj-preview>Sale &lt;50% off&gt; &amp; more</mj-preview>",
    );
  });

  it("handles very long preheader text", async () => {
    const content = createDefaultTemplateContent();
    content.settings.preheaderText = "A".repeat(500);
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(`<mj-preview>${"A".repeat(500)}</mj-preview>`);
  });

  it("does not add preview tag when preheaderText is undefined", async () => {
    const content = createDefaultTemplateContent();
    // preheaderText is optional and undefined by default
    expect(content.settings.preheaderText).toBeUndefined();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
    expect(mjml).toContain("<mj-body");
    expect(mjml).not.toContain("<mj-preview>");
  });

  it("skips blocks that render to empty string", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({
        content: "<p>Visible</p>",
      }),
      createParagraphBlock({
        content: "<p>Hidden</p>",
        visibility: { desktop: false, mobile: false },
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("Visible");
    expect(mjml).not.toContain("Hidden");
  });

  it("emits mjml lang attribute from settings.locale", async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = "de";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="de" dir="ltr">');
  });

  it('uses the default locale ("en") for new templates', async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
  });

  it("escapes locale value in lang attribute", async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = 'en"><script>';
    const mjml = await renderToMjml(content);
    expect(mjml).not.toContain("<script>");
    expect(mjml).toContain('lang="en&quot;&gt;&lt;script&gt;"');
  });

  it("renders decorative image with empty alt and role=presentation", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: "https://example.com/spacer.png",
        alt: "ignored",
        decorative: true,
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('alt=""');
    expect(mjml).not.toContain('alt="ignored"');
    expect(mjml).toContain('role="presentation"');
  });

  it("uses default jsDelivr URL for social icons", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: "facebook", url: "https://facebook.com" }],
        iconStyle: "circle",
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain(
      `src="${DEFAULT_SOCIAL_ICONS_BASE_URL}/circle/facebook.png"`,
    );
  });

  it("honors socialIconsBaseUrl option", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: "twitter", url: "https://twitter.com" }],
        iconStyle: "solid",
      }),
    ];
    const mjml = await renderToMjml(content, {
      socialIconsBaseUrl: "https://cdn.example.com/social",
    });
    expect(mjml).toContain(
      'src="https://cdn.example.com/social/solid/twitter.png"',
    );
  });

  it("strips trailing slash from socialIconsBaseUrl", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSocialIconsBlock({
        icons: [{ platform: "github", url: "https://github.com" }],
        iconStyle: "square",
      }),
    ];
    const mjml = await renderToMjml(content, {
      socialIconsBaseUrl: "https://cdn.example.com/social/",
    });
    expect(mjml).toContain(
      'src="https://cdn.example.com/social/square/github.png"',
    );
    expect(mjml).not.toContain("//square/");
  });

  it("renders non-decorative image preserving alt and omitting role", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createImageBlock({
        src: "https://example.com/hero.png",
        alt: "Spring sale",
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('alt="Spring sale"');
    expect(mjml).not.toContain('role="presentation"');
  });
});

describe("content direction", () => {
  it("emits dir=ltr on an English template", async () => {
    const content = createDefaultTemplateContent();
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="ltr">');
  });

  it("resolves dir=rtl from an Arabic locale when direction is unset", async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = "ar";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="ar" dir="rtl">');
  });

  it("lets an explicit ltr win over an RTL locale", async () => {
    const content = createDefaultTemplateContent();
    content.settings.locale = "ar";
    content.settings.direction = "ltr";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="ar" dir="ltr">');
  });

  it("lets an explicit rtl win over an LTR locale", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    const mjml = await renderToMjml(content);
    expect(mjml).toContain('<mjml lang="en" dir="rtl">');
  });

  it("puts direction=rtl on a multi-column section when the template is RTL", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    content.blocks = [
      createSectionBlock({
        columns: "2",
        children: [
          [createParagraphBlock({ content: "<p>Start</p>" })],
          [createParagraphBlock({ content: "<p>End</p>" })],
        ],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toMatch(/<mj-section[^>]*direction="rtl"/);
    expect(mjml).toContain("Start");
    expect(mjml).toContain("End");
  });

  it("omits section direction when the template is LTR", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createSectionBlock({
        columns: "2",
        children: [
          [createParagraphBlock({ content: "<p>A</p>" })],
          [createParagraphBlock({ content: "<p>B</p>" })],
        ],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).not.toContain('direction="rtl"');
  });

  it("puts direction=rtl on the wrapper section of a top-level title", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    content.blocks = [createTitleBlock({ content: "<p>عنوان</p>" })];
    const mjml = await renderToMjml(content);
    expect(mjml).toMatch(/<mj-section[^>]*direction="rtl"/);
  });

  it("puts direction=rtl on mj-group when stacking is opted out", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    content.blocks = [
      createSectionBlock({
        columns: "2",
        stackOnMobile: false,
        children: [
          [createParagraphBlock({ content: "<p>A</p>" })],
          [createParagraphBlock({ content: "<p>B</p>" })],
        ],
      }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toMatch(/<mj-group[^>]*direction="rtl"/);
  });

  it("aligns an RTL paragraph mj-text to the start edge", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    content.blocks = [createParagraphBlock({ content: "<p>مرحبا</p>" })];
    const mjml = await renderToMjml(content);
    expect(mjml).toMatch(/<mj-text[^>]*align="right"/);
  });

  it("does not force align=right on an LTR paragraph", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: "<p>Hello</p>" })];
    const mjml = await renderToMjml(content);
    expect(mjml).not.toMatch(/<mj-text[^>]*align="right"/);
  });

  it("emits list padding-right in the rich-text stylesheet when RTL", async () => {
    const content = createDefaultTemplateContent();
    content.settings.direction = "rtl";
    content.blocks = [
      createParagraphBlock({ content: "<ul><li>واحد</li></ul>" }),
    ];
    const mjml = await renderToMjml(content);
    expect(mjml).toContain("padding-right: 24px");
    expect(mjml).not.toContain("padding-left: 24px");
  });
});

describe("renderToMjml layout option", () => {
  it("without layout, omitted options match empty options and do not mutate backgroundColor", async () => {
    const content = withBlocks(
      [createParagraphBlock({ content: "<p>Hello</p>" })],
      { backgroundColor: "#abcdef" },
    );

    const omitted = await renderToMjml(content);
    const empty = await renderToMjml(content, {});

    expect(omitted).toBe(empty);
    expect(omitted).toContain("Hello");
    expect(omitted).toContain(
      '<mj-body width="600px" background-color="#abcdef">',
    );
    expect(omitted).not.toContain("<mj-wrapper");
    expect(content.settings.backgroundColor).toBe("#abcdef");
  });

  it("rejects a slot in content when no layout is set", async () => {
    const content = withBlocks([createSlotBlock()]);
    await expect(renderToMjml(content)).rejects.toThrow(SLOT_IN_CONTENT);
  });

  it("emits sibling layout chrome around content and takes backgroundColor from layout", async () => {
    const content = withBlocks(
      [createParagraphBlock({ content: "<p>Author body</p>" })],
      { backgroundColor: "#111111", width: 480 },
    );
    const layout = siblingLayout({ backgroundColor: "#f3f4f6" });
    const before = JSON.stringify(content);

    const mjml = await renderToMjml(content, { layout });

    expect(mjml).toContain("View in browser");
    expect(mjml).toContain("Author body");
    expect(mjml).toContain("Impressum");
    expect(mjml.indexOf("View in browser")).toBeLessThan(
      mjml.indexOf("Author body"),
    );
    expect(mjml.indexOf("Author body")).toBeLessThan(mjml.indexOf("Impressum"));
    expect(mjml).toContain(
      '<mj-body width="480px" background-color="#f3f4f6">',
    );
    expect(content.settings.backgroundColor).toBe("#111111");
    expect(JSON.stringify(content)).toBe(before);
  });

  it("emits a card layout wrapper around author content with Impressum after it", async () => {
    const content = withBlocks([
      createParagraphBlock({ content: "<p>Author body</p>" }),
    ]);
    const layout = cardLayout({ backgroundColor: "#f3f4f6" });
    const before = JSON.stringify(content);

    const mjml = await renderToMjml(content, { layout });

    expect(mjml).toContain("<mj-wrapper");
    expect(mjml).toContain("</mj-wrapper>");
    const wrapperOpen = mjml.indexOf("<mj-wrapper");
    const wrapperClose = mjml.indexOf("</mj-wrapper>");
    const wrapper = mjml.slice(wrapperOpen, wrapperClose);
    expect(wrapper).toContain('background-color="#ffffff"');
    expect(wrapper).toContain('padding="24px 24px 24px 24px"');
    expect(wrapper).toContain('border-radius="12px"');
    expect(wrapper).toContain("Author body");
    expect(wrapper).not.toContain("Impressum");
    expect(mjml.indexOf("Impressum")).toBeGreaterThan(wrapperClose);
    expect(mjml).toContain(
      '<mj-body width="600px" background-color="#f3f4f6">',
    );
    expect(JSON.stringify(content)).toBe(before);
  });

  it("rejects a card layout when content emits mj-wrapper via section.wrapper", async () => {
    const content = withBlocks([
      createSectionBlock({
        wrapper: { backgroundColor: "#eeeeee" },
        children: [[createParagraphBlock({ content: "<p>Author body</p>" })]],
      }),
    ]);
    const before = JSON.stringify(content);

    await expect(
      renderToMjml(content, { layout: cardLayout() }),
    ).rejects.toThrow(NESTED_MJ_WRAPPER);
    expect(JSON.stringify(content)).toBe(before);
  });

  it("rejects a wrapper in content when no layout is set", async () => {
    const content = withBlocks([
      createWrapperBlock({
        children: [createTitleBlock({ content: "<p>Chrome</p>" })],
      }),
    ]);
    await expect(renderToMjml(content)).rejects.toThrow(WRAPPER_IN_CONTENT);
  });
});
