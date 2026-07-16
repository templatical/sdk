import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createTitleBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Document-level text color round-trip (issue #355).
 *
 * A string-presence check on the MJML is not enough: MJML silently drops
 * attributes it doesn't accept in a given position, and `mj-attributes`
 * defaults only take effect if the compiler actually propagates them. These
 * tests compile the renderer's output through the real MJML compiler and
 * assert the resulting HTML carries (or omits) the color — proving the
 * `<mj-attributes><mj-text color>` default reaches paragraph text, that an
 * unset value adds no color, and that a Title's own color still wins.
 */

// Distinctive colors unlikely to appear in default MJML output by accident.
const TEXT_COLOR = "#336699";
const TITLE_COLOR = "#cc0000";

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function htmlContainsColor(html: string, color: string): boolean {
  return html.toLowerCase().includes(color.toLowerCase());
}

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

describe("document text color round-trip through MJML compiler", () => {
  it("paragraph inherits the document text color in the compiled HTML", async () => {
    const content = makeContent([
      createParagraphBlock({ content: "<p>Body text</p>" }),
    ]);
    content.settings.textColor = TEXT_COLOR;

    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, TEXT_COLOR)).toBe(true);
  });

  it("adds no document color to the HTML when textColor is unset", async () => {
    const content = makeContent([
      createParagraphBlock({ content: "<p>Body text</p>" }),
    ]);
    // textColor deliberately left unset.
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, TEXT_COLOR)).toBe(false);
  });

  it("keeps a Title's own color while the paragraph inherits the document color", async () => {
    const content = makeContent([
      createTitleBlock({ content: "<p>Heading</p>", color: TITLE_COLOR }),
      createParagraphBlock({ content: "<p>Body</p>" }),
    ]);
    content.settings.textColor = TEXT_COLOR;

    const html = await compile(await renderToMjml(content));
    // Title override survives compilation...
    expect(htmlContainsColor(html, TITLE_COLOR)).toBe(true);
    // ...and the paragraph still picks up the document default.
    expect(htmlContainsColor(html, TEXT_COLOR)).toBe(true);
  });
});
