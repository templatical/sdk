import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * `mj-button` paints the label at `line-height: 120%` unless the attribute is
 * set. 120% of the font size is the line box the importer's padding fold
 * assumes, so this compiles a button that sets no line-height and reads the
 * anchor MJML emits.
 */

const ctx = new RenderContext(600, [], "Arial, sans-serif", true);

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

function wrapBlock(blockMjml: string): string {
  return `<mjml><mj-body><mj-section><mj-column>${blockMjml}</mj-column></mj-section></mj-body></mjml>`;
}

/** The `<a>` MJML wraps the label in. */
function anchorStyle(html: string): string {
  const match = html.match(/<a\b[^>]*\bstyle="([^"]*)"/);
  if (!match) throw new Error("compiled button has no anchor style");
  return match[1];
}

describe("button label line box through MJML", () => {
  it("is 120% of the font size when the button sets no line-height", async () => {
    const block = createButtonBlock({ text: "Go", url: "#", fontSize: 14 });
    const mjml = renderBlock(block, ctx);
    expect(mjml).not.toContain("line-height=");

    const style = anchorStyle(await compile(wrapBlock(mjml)));
    expect(style).toContain("font-size:14px");
    expect(style).toContain("line-height:120%");
  });
});
