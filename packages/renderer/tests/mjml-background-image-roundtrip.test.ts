import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createBackgroundImage,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createSlotBlock,
  createWrapperBlock,
} from "@templatical/types";
import type { BackgroundImage, Block, TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * MJML drops unknown attributes silently and pastes `background-url` verbatim
 * into inline CSS and Outlook VML, so these tests compile the renderer's output
 * and assert on the HTML, not just the MJML string.
 */

const HERO = "https://cdn.test/hero.jpg";

async function render(
  blocks: Block[],
  layout?: TemplateContent,
): Promise<{ mjml: string; html: string }> {
  const content = { ...createDefaultTemplateContent(), blocks };
  const mjml = await renderToMjml(content, layout ? { layout } : undefined);
  const result = await mjml2html(mjml, { validationLevel: "strict" });
  expect(result.errors).toEqual([]);
  return { mjml, html: result.html };
}

function section(backgroundImage: BackgroundImage | undefined, color?: string) {
  return createSectionBlock({
    children: [[createParagraphBlock({ content: "<p>Hi</p>" })]],
    backgroundImage,
    styles: {
      padding: { top: 20, right: 0, bottom: 20, left: 0 },
      ...(color ? { backgroundColor: color } : {}),
    },
  });
}

describe("background image round-trip through MJML", () => {
  it("section: cover image with a fallback color reaches CSS and VML", async () => {
    const { mjml, html } = await render([
      section(createBackgroundImage(HERO), "#0f172a"),
    ]);
    expect(mjml).toContain(
      `background-url="${HERO}" background-size="cover" background-position="center center" background-repeat="no-repeat"`,
    );
    expect(html).toContain(
      `background:#0f172a url('${HERO}') center center / cover no-repeat`,
    );
    expect(html).toMatch(
      /<v:fill [^>]*src="https:\/\/cdn\.test\/hero\.jpg" color="#0f172a" type="frame" size="1,1" aspect="atleast"/,
    );
  });

  it("section: contain maps to an aspect=atmost VML frame", async () => {
    const { html } = await render([
      section({ ...createBackgroundImage(HERO), size: "contain" }),
    ]);
    expect(html).toContain(`url('${HERO}') center center / contain no-repeat`);
    expect(html).toMatch(/<v:fill [^>]*type="frame" size="1,1" aspect="atmost"/);
  });

  it("section: auto + repeat tiles, with the position in CSS", async () => {
    const { html } = await render([
      section({
        url: "https://cdn.test/tile.png",
        size: "auto",
        position: { x: "left", y: "top" },
        repeat: true,
      }),
    ]);
    expect(html).toContain(
      "url('https://cdn.test/tile.png') left top / auto repeat",
    );
    expect(html).toMatch(/<v:fill [^>]*type="tile"/);
  });

  it("section.wrapper: the band carries its own image", async () => {
    const block = section(undefined);
    block.wrapper = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundImage: createBackgroundImage("https://cdn.test/band.jpg"),
    };
    const { mjml, html } = await render([block]);
    expect(mjml).toMatch(
      /<mj-wrapper[^>]* background-url="https:\/\/cdn\.test\/band\.jpg"/,
    );
    expect(html).toContain(
      "url('https://cdn.test/band.jpg') center center / cover no-repeat",
    );
  });

  it("layout wrapper block: the band carries its own image", async () => {
    // Wrapper blocks are layout-only, so the band reaches the renderer via `layout`.
    const layout = {
      ...createDefaultTemplateContent(),
      blocks: [
        createWrapperBlock({
          children: [createSlotBlock()],
          backgroundImage: createBackgroundImage("https://cdn.test/band.jpg"),
        }),
      ],
    };
    const { mjml, html } = await render([section(undefined)], layout);
    expect(mjml).toMatch(
      /<mj-wrapper[^>]* background-url="https:\/\/cdn\.test\/band\.jpg"/,
    );
    expect(html).toContain("url('https://cdn.test/band.jpg')");
  });

  it.each(["", "   "])("emits nothing for url %j", async (url) => {
    const { mjml } = await render([
      section({ ...createBackgroundImage(HERO), url }),
    ]);
    expect(mjml).not.toContain("background-url");
    expect(mjml).not.toContain("background-size");
  });

  it("keeps a URL that tries to close the CSS string inside it", async () => {
    const { html } = await render([
      section(
        createBackgroundImage("https://x.test/a.jpg?q=1');color:red;x:url('y"),
      ),
    ]);
    expect(html).not.toContain("');color:red");
    expect(html).toContain(
      "url('https://x.test/a.jpg?q=1%27);color:red;x:url(%27y')",
    );
  });

  it("keeps an ampersand in the URL as a query separator", async () => {
    const { mjml, html } = await render([
      section(createBackgroundImage("https://cdn.test/a.jpg?w=1&h=2")),
    ]);
    expect(mjml).toContain(
      'background-url="https://cdn.test/a.jpg?w=1&amp;h=2"',
    );
    expect(html).toContain("url('https://cdn.test/a.jpg?w=1&amp;h=2')");
    expect(html).toContain('src="https://cdn.test/a.jpg?w=1&amp;h=2"');
  });

  it("keeps merge tags intact in CSS and VML", async () => {
    const { html } = await render([
      section(createBackgroundImage("{{ hero_url }}")),
    ]);
    expect(html).toContain("url('{{ hero_url }}')");
    expect(html).toMatch(/<v:fill [^>]*src="\{\{ hero_url \}\}"/);
  });

  it("falls back to cover/center for tampered size and position", async () => {
    const tampered = {
      url: HERO,
      size: "50%;color:red",
      position: { x: "0;color:red", y: "top" },
      repeat: false,
    } as unknown as BackgroundImage;
    const { mjml } = await render([section(tampered)]);
    expect(mjml).toContain(
      'background-size="cover" background-position="center top"',
    );
    expect(mjml).not.toContain("color:red");
  });
});
