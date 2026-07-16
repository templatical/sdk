import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createTitleBlock,
  createMenuBlock,
  createTableBlock,
  createDefaultTemplateContent,
  generateId,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Document-level text color cascade (issue #355), verified through the real
 * MJML compiler — a string check on the MJML alone can't prove the color
 * reaches the rendered text (MJML silently drops attributes it doesn't accept,
 * and `mj-attributes` defaults only apply if the compiler propagates them).
 *
 * Cascade: an explicit per-block `color` > the document `textColor` (the
 * `<mj-text>` default) > MJML's own default. All text blocks (paragraph,
 * title, menu, table) render as `mj-text`, so an unset block color inherits
 * the document default.
 */

const DOC = "#336699"; // a custom document text color
const OVERRIDE = "#cc0000"; // an explicit per-block override
const DEFAULT_DOC = "#1a1a1a"; // the built-in document default

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

describe("document text color cascade — round-trip through MJML compiler", () => {
  it("renders body text at the #1a1a1a default when nothing is customized", async () => {
    const content = makeContent([
      createParagraphBlock({ content: "<p>Body</p>" }),
    ]);
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, DEFAULT_DOC)).toBe(true);
  });

  it("paragraph inherits a custom document text color", async () => {
    const content = makeContent([
      createParagraphBlock({ content: "<p>Body</p>" }),
    ]);
    content.settings.textColor = DOC;
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, DOC)).toBe(true);
  });

  it("title inherits the document color when unset, and overrides when set", async () => {
    const content = makeContent([
      createTitleBlock({ content: "<p>Inherits</p>" }), // no color → inherit
      createTitleBlock({ content: "<p>Overrides</p>", color: OVERRIDE }),
    ]);
    content.settings.textColor = DOC;
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, DOC)).toBe(true); // first title inherits
    expect(htmlContainsColor(html, OVERRIDE)).toBe(true); // second overrides
  });

  it("menu with no color inherits the document color (no `color: undefined` leak)", async () => {
    const content = makeContent([
      createMenuBlock({
        items: [{ id: generateId(), text: "Home", url: "https://example.com" }],
      } as Parameters<typeof createMenuBlock>[0]),
    ]);
    content.settings.textColor = DOC;
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, DOC)).toBe(true);
    // The item anchor must omit an explicit color, not emit `color: undefined`.
    expect(html.toLowerCase()).not.toContain("color: undefined");
  });

  it("table with no color inherits the document color", async () => {
    const content = makeContent([
      createTableBlock({
        rows: [
          { id: generateId(), cells: [{ id: generateId(), content: "Cell" }] },
        ],
      } as Parameters<typeof createTableBlock>[0]),
    ]);
    content.settings.textColor = DOC;
    const html = await compile(await renderToMjml(content));
    expect(htmlContainsColor(html, DOC)).toBe(true);
  });
});
