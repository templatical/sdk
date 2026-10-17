import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createBackgroundImage,
  createButtonBlock,
  createDefaultTemplateContent,
  createHtmlBlock,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
} from "@templatical/types";
import type {
  BackgroundImage,
  Block,
  BorderSideValue,
  SectionBlock,
  SectionHero,
  TemplateContent,
  TemplateSettings,
} from "@templatical/types";
import { renderToMjml, type RenderOptions } from "../src";

/**
 * Compiled through mjml@5 with strict validation: mj-hero rejects attributes
 * it doesn't know (`direction`, `border`), and MJML pastes the sizing into
 * inline CSS and Outlook VML, so the assertions read the HTML.
 */

const HERO_URL = "https://cdn.test/hero.jpg";
const MEASURED: BackgroundImage = {
  ...createBackgroundImage(HERO_URL),
  width: 1200,
  height: 800,
};
const MATCH: SectionHero = { height: "image", verticalAlign: "middle" };
const BAND = { top: 0, right: 20, bottom: 0, left: 20 };

async function render(
  blocks: Block[],
  options: {
    layout?: TemplateContent;
    settings?: Partial<TemplateSettings>;
    render?: RenderOptions;
  } = {},
): Promise<{ mjml: string; html: string }> {
  const content = { ...createDefaultTemplateContent(), blocks };
  content.settings = { ...content.settings, ...options.settings };
  const mjml = await renderToMjml(content, {
    ...options.render,
    ...(options.layout ? { layout: options.layout } : {}),
  });
  const result = await mjml2html(mjml, { validationLevel: "strict" });
  expect(result.errors).toEqual([]);
  return { mjml, html: result.html };
}

function hero(overrides: Partial<SectionBlock> = {}): SectionBlock {
  return createSectionBlock({
    children: [[createParagraphBlock({ content: "<p>Big news</p>" })]],
    backgroundImage: MEASURED,
    hero: MATCH,
    styles: {
      padding: { top: 48, right: 24, bottom: 48, left: 24 },
      backgroundColor: "#0f172a",
    },
    ...overrides,
  });
}

// `<mj-head>` declares `<mj-section padding="0" />` as a global default, so
// "no mj-section" is a claim about the body.
function bodyOf(mjml: string): string {
  return mjml.slice(mjml.indexOf("<mj-body"));
}

function heroTag(mjml: string): string {
  const tag = /<mj-hero[^>]*>/.exec(mjml);
  expect(tag).not.toBeNull();
  return tag![0];
}

describe("hero round-trip through MJML", () => {
  it("matches the image: fluid-height, the box at the image's shape", async () => {
    const { mjml, html } = await render([hero()]);
    expect(heroTag(mjml)).toBe(
      `<mj-hero mode="fluid-height" background-url="${HERO_URL}" background-width="600px" background-height="400px" background-position="center center" background-color="#0f172a" padding="48px 24px 48px 24px" vertical-align="middle">`,
    );
    expect(bodyOf(mjml)).not.toContain("<mj-section");
    expect(html).toContain(
      `background:#0f172a url('${HERO_URL}') no-repeat center center / cover`,
    );
    expect(html).toContain("padding-bottom:67%");
    expect(html).toContain(
      `<v:image style="border:0;height:400px;mso-position-horizontal:center;position:absolute;top:0;width:600px;z-index:-3;" src="${HERO_URL}"`,
    );
    expect(html).toContain("Big news");
  });

  it("gives a fixed height fixed-height, padding included in the height", async () => {
    const { mjml, html } = await render([
      hero({
        hero: { height: 300, verticalAlign: "bottom" },
        styles: {
          padding: { top: 40, right: 24, bottom: 40, left: 24 },
          backgroundColor: "#0f172a",
        },
      }),
    ]);
    expect(heroTag(mjml)).toContain(
      'mode="fixed-height" height="300px" background-url',
    );
    expect(heroTag(mjml)).toContain('background-height="400px"');
    expect(heroTag(mjml)).toContain('vertical-align="bottom"');
    expect(html).toContain('height="220"');
    expect(html).toContain("vertical-align:bottom");
  });

  it("sizes an unmeasured image to a fixed box", async () => {
    const { mjml } = await render([
      hero({
        backgroundImage: createBackgroundImage(HERO_URL),
        hero: { height: 320, verticalAlign: "middle" },
      }),
    ]);
    expect(heroTag(mjml)).toContain(
      'background-width="600px" background-height="320px"',
    );
  });

  it("paints no fill as transparent, not mj-hero's white", async () => {
    const { mjml, html } = await render([
      hero({ styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } } }),
    ]);
    expect(heroTag(mjml)).toContain('background-color="transparent"');
    expect(html).toContain(`background:transparent url('${HERO_URL}')`);
  });

  it.each<[string, Partial<SectionBlock>]>([
    [
      "two columns",
      {
        columns: "2",
        children: [[createParagraphBlock()], [createParagraphBlock()]],
      },
    ],
    ["no image", { backgroundImage: undefined }],
    ["an unmeasured image", { backgroundImage: createBackgroundImage(HERO_URL) }],
  ])("renders a regular section with %s", async (_label, overrides) => {
    const { mjml } = await render([hero(overrides)]);
    expect(mjml).not.toContain("<mj-hero");
    expect(bodyOf(mjml)).toContain("<mj-section");
  });

  it("emits no border, size or repeat in hero mode, but keeps the radius", async () => {
    const side: BorderSideValue = { width: 2, style: "solid", color: "#ff0000" };
    const { mjml } = await render([
      hero({
        border: { top: side, right: side, bottom: side, left: side },
        borderRadius: 12,
        backgroundImage: { ...MEASURED, size: "contain", repeat: true },
      }),
    ]);
    const tag = heroTag(mjml);
    expect(tag).not.toMatch(/border=|border-top|background-size|background-repeat/);
    expect(tag).toContain('border-radius="12px"');
  });

  it("narrows the image to the box inside a padded section wrapper", async () => {
    const { mjml, html } = await render([hero({ wrapper: { padding: BAND } })]);
    expect(mjml).toContain("<mj-wrapper");
    expect(heroTag(mjml)).toContain(
      'background-width="560px" background-height="373px"',
    );
    expect(html).toContain("height:373px;mso-position-horizontal:center;position:absolute;top:0;width:560px");
  });

  it("narrows the image to the box inside a padded layout band", async () => {
    const layout = {
      ...createDefaultTemplateContent(),
      blocks: [
        createWrapperBlock({
          children: [createSlotBlock()],
          styles: { padding: { top: 10, right: 30, bottom: 10, left: 30 } },
        }),
      ],
    };
    const { mjml } = await render([hero()], { layout });
    expect(heroTag(mjml)).toContain('background-width="540px"');
  });

  it("leaves a regular section's widths alone inside a padded wrapper", async () => {
    const { mjml } = await render([
      createSectionBlock({
        children: [[createImageBlock({ src: "https://cdn.test/a.png", width: "full" })]],
        wrapper: { padding: BAND },
      }),
    ]);
    expect(mjml).toMatch(/<mj-image[^>]*width="600px"/);
  });

  it("leaves an RTL hero's text to the body's direction", async () => {
    const { mjml, html } = await render([hero()], {
      settings: { direction: "rtl" },
    });
    expect(heroTag(mjml)).not.toContain("direction");
    const directions = [...html.matchAll(/direction:\s*(ltr|rtl)/g)].map(
      (match) => match[1],
    );
    expect(directions).not.toContain("ltr");
    expect(html).toContain('dir="rtl"');
  });

  it("carries the visibility class, which mj-hero puts on its outer div", async () => {
    const { mjml, html } = await render([
      hero({ visibility: { desktop: true, mobile: false } }),
    ]);
    expect(heroTag(mjml)).toContain('css-class="tpl-hide-mobile"');
    expect(html).toContain('class="tpl-hide-mobile"');
  });

  it("brackets a conditional hero in mj-raw guards", async () => {
    const { mjml } = await render([
      hero({
        displayCondition: {
          label: "VIP",
          before: "{% if vip %}",
          after: "{% endif %}",
        },
      }),
    ]);
    expect(mjml).toMatch(/<mj-raw>\{% if vip %\}<\/mj-raw>\s*<mj-hero/);
    expect(mjml).toMatch(/<\/mj-hero>\s*<mj-raw>\{% endif %\}<\/mj-raw>/);
  });

  it("filters the content as a column's: html when disallowed, nested sections", async () => {
    const { mjml } = await render(
      [
        hero({
          children: [
            [
              createHtmlBlock({ content: "<b>raw</b>" }),
              createSectionBlock() as Block,
              createButtonBlock({ text: "Go" }),
            ],
          ],
        }),
      ],
      { render: { allowHtmlBlocks: false } },
    );
    expect(mjml).not.toContain("<b>raw</b>");
    expect(bodyOf(mjml)).not.toContain("<mj-section");
    expect(mjml).toContain("<mj-button");
  });

  it("compiles a hero with no content", async () => {
    const { mjml } = await render([hero({ children: [[]] })]);
    expect(heroTag(mjml)).toContain('mode="fluid-height"');
  });

  it("keeps a merge-tag URL intact on a fixed-height hero", async () => {
    const { mjml, html } = await render([
      hero({
        backgroundImage: createBackgroundImage("{{ hero_url }}"),
        hero: { height: 300, verticalAlign: "middle" },
      }),
    ]);
    expect(heroTag(mjml)).toContain('background-url="{{ hero_url }}"');
    expect(html).toContain("url('{{ hero_url }}')");
  });

  it("keeps a URL that tries to close the CSS string inside it", async () => {
    const { html } = await render([
      hero({
        backgroundImage: {
          ...MEASURED,
          url: "https://x.test/a.jpg?q=1');color:red;x:url('y",
        },
      }),
    ]);
    expect(html).not.toContain("');color:red");
    expect(html).toContain("%27");
  });

  it("leaves a section renderer override in charge", async () => {
    const { mjml } = await render([hero()], {
      render: {
        blockRenderers: {
          section: () =>
            "<mj-section><mj-column><mj-text>custom</mj-text></mj-column></mj-section>",
        },
      },
    });
    expect(mjml).toContain("custom");
    expect(mjml).not.toContain("<mj-hero");
  });
});

describe("hero content width", () => {
  // mj-hero gives its content the box less its own side padding, and draws no
  // border. `fluid-on-mobile` goes only on an image that fills that room, so
  // the renderer has to measure it the same way. Each room is read back from
  // MJML by compiling a 9999px probe image.
  const PROBE = "https://cdn.test/probe.png";
  const SECTION_PADDING = { top: 48, right: 24, bottom: 48, left: 24 };

  function probe(width: number | "full"): Block {
    return createImageBlock({ src: PROBE, alt: "probe", width });
  }

  function heroWith(width: number | "full", overrides: Partial<SectionBlock> = {}): Block[] {
    return [hero({ wrapper: { padding: BAND }, children: [[probe(width)]], ...overrides })];
  }

  function sectionWith(width: number | "full", band = BAND): Block[] {
    return [
      createSectionBlock({
        children: [[probe(width)]],
        wrapper: { padding: band },
        styles: { padding: SECTION_PADDING },
      }),
    ];
  }

  function probeTag(markup: string, tag: "<mj-image" | "<img"): string {
    const at = markup.indexOf(`src="${PROBE}"`);
    expect(at).toBeGreaterThan(-1);
    return markup.slice(markup.lastIndexOf(tag, at), markup.indexOf(">", at) + 1);
  }

  async function roomOf(build: (width: number) => Block[]): Promise<number> {
    const { html } = await render(build(9999));
    const width = /\bwidth="(\d+)"/.exec(probeTag(html, "<img"));
    expect(width).not.toBeNull();
    return Number(width![1]);
  }

  async function isFluid(blocks: Block[]): Promise<boolean> {
    const { mjml } = await render(blocks);
    return probeTag(mjml, "<mj-image").includes('fluid-on-mobile="true"');
  }

  it("gives an image in a padded hero the room a section with the same padding gives it", async () => {
    // 600 − 40 (band) − 48 (hero padding) − 20 (image padding).
    expect(await roomOf((w) => heroWith(w))).toBe(492);
    expect(await roomOf(sectionWith)).toBe(492);
    expect(await isFluid(heroWith(492))).toBe(true);
    expect(await isFluid(sectionWith(492))).toBe(true);
    expect(await isFluid(heroWith(491))).toBe(false);
    expect(await isFluid(sectionWith(491))).toBe(false);
  });

  it("leaves the hidden section border out of the hero's content room", async () => {
    const side: BorderSideValue = { width: 3, style: "solid", color: "#ff0000" };
    const border = { top: side, right: side, bottom: side, left: side };
    expect(await roomOf((w) => heroWith(w, { border }))).toBe(492);
    expect(await isFluid(heroWith(492, { border }))).toBe(true);
  });

  it("floors a fractional band as a section does, so no half pixel reaches the export", async () => {
    const band = { top: 0, right: 20, bottom: 0, left: 20.5 };
    const inBand = (width: number | "full") =>
      heroWith(width, { wrapper: { padding: band } });
    const { mjml } = await render(inBand("full"));
    expect(heroTag(mjml)).toContain('background-width="559px"');
    expect(probeTag(mjml, "<mj-image")).toContain('width="559px"');
    expect(probeTag(mjml, "<mj-image")).toContain('fluid-on-mobile="true"');
    // floor(600 − 40.5) − 48 (hero padding) − 20 (image padding).
    expect(await isFluid(inBand(491))).toBe(true);
    expect(await isFluid(sectionWith(491, band))).toBe(true);
    expect(await isFluid(inBand(490))).toBe(false);
    expect(await isFluid(sectionWith(490, band))).toBe(false);
  });
});
