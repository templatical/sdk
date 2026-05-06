import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createTitleBlock,
  createImageBlock,
  createTableBlock,
  createMenuBlock,
  createVideoBlock,
  createSectionBlock,
  createButtonBlock,
  createDividerBlock,
  createSpacerBlock,
  createSocialIconsBlock,
  createDefaultTemplateContent,
  generateId,
} from "@templatical/types";
import type { TemplateContent, MenuItemData } from "@templatical/types";
import { renderToMjml } from "../src";
import { renderBlock, RenderContext } from "../src";

/**
 * MJML silently drops attributes it doesn't recognize. The most common trap is
 * `background-color` on inner content elements (mj-text, mj-image, mj-table,
 * mj-navbar, mj-video) — these only support `container-background-color`.
 *
 * These tests compile the renderer's output through the actual MJML compiler
 * and assert the resulting HTML carries the bg color. A string-presence check
 * on the MJML alone wouldn't catch the silent-drop class of bug.
 */

const BG_COLOR = "#fffbeb"; // a distinctive amber that's unlikely to appear by accident
const SECTION_BG = "#0f172a";
const BUTTON_BG = "#22c55e";

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function wrapBlock(blockMjml: string): string {
  return `<mjml><mj-body><mj-section><mj-column>${blockMjml}</mj-column></mj-section></mj-body></mjml>`;
}

function htmlContainsColor(html: string, color: string): boolean {
  // MJML emits colors with various formatters; normalize to lowercase.
  return html.toLowerCase().includes(color.toLowerCase());
}

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks,
  };
}

describe("background-color round-trip through MJML compiler", () => {
  it("paragraph: renderer emits container-background-color and HTML carries it", async () => {
    const block = createParagraphBlock({
      content: "<p>hi</p>",
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createParagraphBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    expect(mjml).not.toMatch(/<mj-text[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("title: renderer emits container-background-color and HTML carries it", async () => {
    const block = createTitleBlock({
      content: "<p>Hello</p>",
      level: 1,
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createTitleBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    expect(mjml).not.toMatch(/<mj-text[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("image: renderer emits container-background-color and HTML carries it", async () => {
    const block = createImageBlock({
      src: "https://example.com/x.png",
      alt: "x",
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createImageBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    expect(mjml).not.toMatch(/<mj-image[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("table: renderer emits container-background-color and HTML carries it", async () => {
    const block = createTableBlock({
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createTableBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    // The mj-text wrapper for table must not carry a native background-color.
    expect(mjml).not.toMatch(/<mj-text[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("menu: renderer emits container-background-color and HTML carries it", async () => {
    const items: MenuItemData[] = [
      { id: generateId(), text: "Home", url: "https://example.com" },
    ];
    const block = createMenuBlock({
      items,
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createMenuBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    expect(mjml).not.toMatch(/<mj-text[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("video: renderer emits container-background-color and HTML carries it", async () => {
    const block = createVideoBlock({
      url: "https://vimeo.com/123456",
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createVideoBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`);
    expect(mjml).not.toMatch(/<mj-image[^>]*\sbackground-color=/);

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });

  it("section: renderer emits native background-color (mj-section supports it)", async () => {
    const block = createSectionBlock({
      styles: { backgroundColor: SECTION_BG },
    } as Parameters<typeof createSectionBlock>[0]);

    const content = makeContent([block]);
    const mjml = await renderToMjml(content);

    expect(mjml).toMatch(
      new RegExp(`<mj-section[^>]*\\sbackground-color="${SECTION_BG}"`),
    );
    expect(mjml).not.toContain(`container-background-color="${SECTION_BG}"`);

    const html = await compile(mjml);
    expect(htmlContainsColor(html, SECTION_BG)).toBe(true);
  });

  it("divider: backgroundColor must be attribute-escaped to survive MJML compile", async () => {
    // Simulate a malicious or imported color value that breaks out of the
    // attribute boundary. The literal `"` must be HTML-encoded so it stays
    // inside the value rather than reshaping the MJML attribute list.
    const evilColor = `red" foo="x`;
    const block = createDividerBlock({
      styles: { backgroundColor: evilColor as unknown as string },
    } as Parameters<typeof createDividerBlock>[0]);
    const mjml = renderBlock(block, ctx);

    expect(mjml).toContain(
      `container-background-color="red&quot; foo=&quot;x"`,
    );
    expect(mjml).not.toContain(`container-background-color="${evilColor}"`);
  });

  it("spacer: backgroundColor must be attribute-escaped", async () => {
    const evilColor = `red" foo="x`;
    const block = createSpacerBlock({
      styles: { backgroundColor: evilColor as unknown as string },
    } as Parameters<typeof createSpacerBlock>[0]);
    const mjml = renderBlock(block, ctx);

    expect(mjml).toContain(
      `container-background-color="red&quot; foo=&quot;x"`,
    );
    expect(mjml).not.toContain(`container-background-color="${evilColor}"`);
  });

  it("social: backgroundColor must be attribute-escaped", async () => {
    const evilColor = `red" foo="x`;
    const block = createSocialIconsBlock({
      icons: [
        {
          id: generateId(),
          platform: "facebook",
          url: "https://example.com",
        },
      ],
      styles: { backgroundColor: evilColor as unknown as string },
    } as Parameters<typeof createSocialIconsBlock>[0]);
    const mjml = renderBlock(block, ctx);

    expect(mjml).toContain(
      `container-background-color="red&quot; foo=&quot;x"`,
    );
    expect(mjml).not.toContain(`container-background-color="${evilColor}"`);
  });

  it("title: color attribute must be escaped against attribute-injection", async () => {
    const evilColor = `red" align="right`;
    const block = createTitleBlock({
      content: "<p>Hi</p>",
      level: 2,
      color: evilColor as unknown as string,
      textAlign: "left",
    });
    const mjml = renderBlock(block, ctx);

    expect(mjml).toContain(`color="red&quot; align=&quot;right"`);
    expect(mjml).not.toContain(`color="${evilColor}"`);
  });

  it("button: cell bg uses container-background-color, button face uses native background-color", async () => {
    const block = createButtonBlock({
      text: "Click",
      url: "https://example.com",
      backgroundColor: BUTTON_BG,
      styles: { backgroundColor: BG_COLOR },
    } as Parameters<typeof createButtonBlock>[0]);

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain(`background-color="${BUTTON_BG}"`); // button face
    expect(mjml).toContain(`container-background-color="${BG_COLOR}"`); // cell

    const html = await compile(wrapBlock(mjml));
    expect(htmlContainsColor(html, BUTTON_BG)).toBe(true);
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });
});

describe("MJML silent-drop trap (regression baseline)", () => {
  /**
   * Documents the actual MJML behavior we're protecting against: passing
   * `background-color` to `mj-text` is silently ignored by the compiler.
   * If a future change reverts the renderer to the buggy form, the
   * round-trip tests above will fail because the color won't appear in HTML.
   * This test pins the trap so the contract is explicit.
   */
  it("hand-crafted MJML with background-color on mj-text produces HTML without that color", async () => {
    const buggyMjml = `<mjml><mj-body><mj-section><mj-column>
      <mj-text background-color="${BG_COLOR}">hi</mj-text>
    </mj-column></mj-section></mj-body></mjml>`;

    const html = await compile(buggyMjml);
    expect(htmlContainsColor(html, BG_COLOR)).toBe(false);
  });

  it("hand-crafted MJML with container-background-color on mj-text produces HTML carrying that color", async () => {
    const correctMjml = `<mjml><mj-body><mj-section><mj-column>
      <mj-text container-background-color="${BG_COLOR}">hi</mj-text>
    </mj-column></mj-section></mj-body></mjml>`;

    const html = await compile(correctMjml);
    expect(htmlContainsColor(html, BG_COLOR)).toBe(true);
  });
});
