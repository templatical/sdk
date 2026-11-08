import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * `mj-button` paints the label at `line-height: 120%`. The renderer writes
 * that value explicitly, matching the line box the canvas and importer's
 * padding fold use while keeping the compiled anchor style unchanged.
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
  it("writes 120% on MJML and keeps 120% in the compiled anchor", async () => {
    const block = createButtonBlock({ text: "Go", url: "#", fontSize: 14 });
    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('line-height="120%"');

    const style = anchorStyle(await compile(wrapBlock(mjml)));
    expect(style).toContain("font-size:14px");
    expect(style).toContain("line-height:120%");
  });
});
