import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createMenuBlock,
  createDefaultTemplateContent,
  generateId,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Document-level link styling (issue #352), verified through the real MJML
 * compiler. The renderer emits a single global `<mj-style>` rule —
 * `a { color: <linkColor|inherit>; text-decoration: <underline|none> }` — that
 * MJML places in the compiled `<head>`, so it governs every link (rich-text
 * and menu). A string check on the MJML alone can't prove the rule survives
 * compilation, nor that an unset menu item actually defers to it rather than
 * carrying its own inline color.
 *
 * Cascade: an inline per-link/per-item `color` (highest specificity) > the
 * document `a { color }` rule > `inherit` (follow the surrounding text color).
 */

const LINK = "#ff6600"; // a custom document link color
const MENU_ITEM = "#0055ff"; // an explicit per-item override

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

// The inline `style="…"` of the `<a>…text…</a>` anchor in the compiled HTML.
// Empty string when the anchor has no style attribute.
function anchorStyle(html: string, text: string): string {
  const anchor = new RegExp(`<a\\b[^>]*>\\s*${text}\\s*</a>`, "i").exec(html);
  if (!anchor) {
    throw new Error(`anchor for "${text}" not found in compiled HTML`);
  }
  const style = /style="([^"]*)"/i.exec(anchor[0]);
  return style ? style[1] : "";
}

function paragraphWithLink(): TemplateContent["blocks"] {
  return [
    createParagraphBlock({
      content: '<p><a href="https://example.com">Link</a></p>',
    }),
  ];
}

describe("document link styling — round-trip through MJML compiler", () => {
  it("defaults to inherited color and underlined links", async () => {
    const html = await compile(
      await renderToMjml(makeContent(paragraphWithLink())),
    );
    expect(html).toContain("a { color: inherit; text-decoration: underline; }");
    expect(anchorStyle(html, "Link")).toBe("");
  });

  it("emits the document link color when linkColor is set", async () => {
    const content = makeContent(paragraphWithLink());
    content.settings.linkColor = LINK;
    const html = await compile(await renderToMjml(content));
    expect(html).toContain(`a { color: ${LINK}; text-decoration: underline; }`);
  });

  it("renders no underline when linkUnderline is false", async () => {
    const content = makeContent(paragraphWithLink());
    content.settings.linkUnderline = false;
    const html = await compile(await renderToMjml(content));
    expect(html).toContain("a { color: inherit; text-decoration: none; }");
  });

  it("combines a custom link color with no underline", async () => {
    const content = makeContent(paragraphWithLink());
    content.settings.linkColor = LINK;
    content.settings.linkUnderline = false;
    const html = await compile(await renderToMjml(content));
    expect(html).toContain(`a { color: ${LINK}; text-decoration: none; }`);
  });

  it("cascades the document link color to an unset menu item, while a per-item color overrides", async () => {
    const content = makeContent([
      createMenuBlock({
        items: [
          { id: generateId(), text: "Inherit", url: "https://example.com" },
          {
            id: generateId(),
            text: "Override",
            url: "https://example.com",
            color: MENU_ITEM,
          },
        ],
      } as Parameters<typeof createMenuBlock>[0]),
    ]);
    content.settings.linkColor = LINK;
    const html = await compile(await renderToMjml(content));

    // The global rule carries the document link color…
    expect(html).toContain(`a { color: ${LINK};`);
    // …the unset item's anchor omits an inline color, so the global rule
    // governs it (it renders at the document link color).
    expect(anchorStyle(html, "Inherit")).not.toContain("color:");
    // …and an explicit per-item color still wins via its inline style.
    expect(anchorStyle(html, "Override")).toContain(`color: ${MENU_ITEM}`);
  });
});
