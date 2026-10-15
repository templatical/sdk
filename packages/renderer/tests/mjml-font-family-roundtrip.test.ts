import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createMenuBlock,
  createParagraphBlock,
  createTableBlock,
  createTitleBlock,
  generateId,
} from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";
import type { RenderOptions } from "../src";

/**
 * `font-family` values reach MJML as double-quoted attributes, so a family
 * quoted with `"` (`"Helvetica Neue", Arial` — valid CSS, and what imported or
 * hand-written templates carry) must be attribute-escaped. Unescaped, the
 * compiler reads the attribute as empty and every text node renders with
 * `font-family:;`. Verified through the real compiler: a string check on the
 * MJML can't show what reaches the HTML.
 */

const QUOTED_STACK = '"Helvetica Neue", Arial, sans-serif';

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

async function renderHtml(
  content: TemplateContent,
  options?: RenderOptions,
): Promise<string> {
  return compile(await renderToMjml(content, options));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Every `font-family` declared in a `style` attribute, entity-decoded. */
function styleFontFamilies(html: string): string[] {
  return [...html.matchAll(/style="([^"]*)"/g)].flatMap(([, style]) =>
    [...decodeEntities(style).matchAll(/font-family:\s*([^;]*)/g)].map(
      ([, family]) => family.trim(),
    ),
  );
}

function makeContent(blocks: Block[], fontFamily = "Arial"): TemplateContent {
  const content = createDefaultTemplateContent();
  return { ...content, blocks, settings: { ...content.settings, fontFamily } };
}

describe("font-family — round-trip through MJML compiler", () => {
  it("keeps a double-quoted document font stack on body text", async () => {
    const html = await renderHtml(
      makeContent(
        [createParagraphBlock({ content: "<p>Body</p>" })],
        QUOTED_STACK,
      ),
    );

    const families = styleFontFamilies(html);
    expect(families).toContain(QUOTED_STACK);
    expect(families).not.toContain("");
  });

  it.each<[string, () => Block]>([
    [
      "title",
      () =>
        createTitleBlock({ content: "<p>Hi</p>", fontFamily: QUOTED_STACK }),
    ],
    ["button", () => createButtonBlock({ fontFamily: QUOTED_STACK })],
    [
      "menu",
      () =>
        createMenuBlock({
          items: [
            {
              id: generateId(),
              text: "Home",
              url: "https://example.com",
              openInNewTab: false,
              bold: false,
              underline: false,
            },
          ],
          fontFamily: QUOTED_STACK,
        }),
    ],
    [
      "table",
      () =>
        createTableBlock({
          rows: [
            {
              id: generateId(),
              cells: [{ id: generateId(), content: "Cell" }],
            },
          ],
          fontFamily: QUOTED_STACK,
        } as Parameters<typeof createTableBlock>[0]),
    ],
  ])("keeps a double-quoted stack on a %s block", async (_, build) => {
    const html = await renderHtml(makeContent([build()]));

    const families = styleFontFamilies(html);
    expect(families).toContain(QUOTED_STACK);
    expect(families).not.toContain("");
  });

  it("can't break out of the attribute into another MJML attribute", async () => {
    const html = await renderHtml(
      makeContent([
        createTitleBlock({
          content: "<p>Hi</p>",
          fontFamily: 'Arial" css-class="injected',
        }),
      ]),
    );

    expect(html).not.toMatch(/class="[^"]*\binjected\b/);
    expect(styleFontFamilies(html)).toContain('Arial" css-class="injected');
  });

  it("emits single-quoted built-in and custom font stacks unchanged", async () => {
    const content = makeContent(
      [
        createParagraphBlock({ content: "<p>Body</p>" }),
        createTitleBlock({ content: "<p>Hi</p>", fontFamily: "Inter" }),
      ],
      "Times New Roman",
    );
    const options = {
      customFonts: [
        { name: "Inter", url: "https://fonts.example.com/inter.css" },
      ],
    };
    const mjml = await renderToMjml(content, options);
    const html = await compile(mjml);

    // Only `&<>"` are escaped, so the renderer's own `'` quoting stays literal.
    expect(mjml).toContain(`<mj-all font-family="'Times New Roman', serif" />`);
    expect(mjml).toContain(`font-family="'Inter', Arial, sans-serif"`);
    expect(html).toContain("font-family:'Times New Roman', serif;");
    expect(html).toContain("font-family:'Inter', Arial, sans-serif;");
    expect(html).not.toContain("&#039;");
    // MJML links an `mj-font` only when a font-family attribute uses it.
    expect(html).toContain('href="https://fonts.example.com/inter.css"');
  });
});
