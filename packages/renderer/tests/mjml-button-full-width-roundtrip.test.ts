import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * MJML gives a button's `<a>` a width only for a px `width`. For `100%` it
 * sizes the button's `<table>` and leaves the `<a>` at `display:inline-block`,
 * so a full-width button paints the whole column but only its label is
 * clickable (issue #868).
 *
 * The fix is a rule in `<mj-head>`, which a single-block MJML string never
 * carries, so these compile the full `renderToMjml` output and assert on the
 * button's own `<a>`. juice re-serialises every style it touches
 * (`display: block;` with a space), hence the whitespace-tolerant patterns.
 */

const DISPLAY_BLOCK = /display\s*:\s*block\b/;
const DISPLAY_INLINE_BLOCK = /display\s*:\s*inline-block\b/;

async function compile(content: TemplateContent): Promise<string> {
  const result = await mjml2html(await renderToMjml(content));
  expect(result.errors).toEqual([]);
  return result.html;
}

function contentWith(...blocks: TemplateContent["blocks"]): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return content;
}

/** The `style` of the `<a>` linking to `href`. */
function anchorStyle(html: string, href: string): string {
  const escaped = href.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const tag = html.match(new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>`));
  expect(tag).not.toBeNull();
  return tag![0].match(/style="([^"]*)"/)?.[1] ?? "";
}

describe("full-width button link fills the button", () => {
  it("makes a full-width button's <a> a block", async () => {
    const html = await compile(
      contentWith(
        createButtonBlock({
          text: "Go",
          url: "https://full.test",
          width: "full",
        }),
      ),
    );

    const style = anchorStyle(html, "https://full.test");
    expect(style).toMatch(DISPLAY_BLOCK);
    expect(style).not.toMatch(DISPLAY_INLINE_BLOCK);
  });

  it("leaves px-width and fit-to-content buttons inline-block next to a full-width one", async () => {
    const html = await compile(
      contentWith(
        createButtonBlock({
          text: "Full",
          url: "https://full.test",
          width: "full",
        }),
        createButtonBlock({ text: "Px", url: "https://px.test", width: 240 }),
        createButtonBlock({ text: "Fit", url: "https://fit.test" }),
      ),
    );

    expect(anchorStyle(html, "https://full.test")).toMatch(DISPLAY_BLOCK);
    expect(anchorStyle(html, "https://px.test")).toMatch(DISPLAY_INLINE_BLOCK);
    expect(anchorStyle(html, "https://fit.test")).toMatch(DISPLAY_INLINE_BLOCK);
  });

  it("makes a full-width button's <a> a block inside a 2-column section", async () => {
    const html = await compile(
      contentWith(
        createSectionBlock({
          columns: "2",
          children: [
            [
              createButtonBlock({
                text: "Go",
                url: "https://full.test",
                width: "full",
              }),
            ],
            [createParagraphBlock({ content: "<p>Beside it</p>" })],
          ],
        }),
      ),
    );

    const style = anchorStyle(html, "https://full.test");
    expect(style).toMatch(DISPLAY_BLOCK);
    expect(style).not.toMatch(DISPLAY_INLINE_BLOCK);
  });

  it("leaves no trace of the rule in a template without a full-width button", async () => {
    // Every template carries the rule; juice drops it when nothing matches.
    const html = await compile(
      contentWith(createButtonBlock({ text: "Fit", url: "https://fit.test" })),
    );

    expect(html).not.toContain("tpl-button-full");
    expect(anchorStyle(html, "https://fit.test")).toMatch(DISPLAY_INLINE_BLOCK);
  });
});
