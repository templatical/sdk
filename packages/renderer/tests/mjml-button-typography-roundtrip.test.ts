import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createButtonBlock, type ButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * A button label is bold when `fontWeight` is omitted. Each stored value is a
 * CSS weight on `mj-button`, and this compiles that attribute through mjml@5.
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

function anchorStyle(html: string): string {
  const match = html.match(/<a\b[^>]*\bstyle="([^"]*)"/);
  if (!match) throw new Error("compiled button has no anchor style");
  return match[1];
}

const CASES: [string, ButtonBlock["fontWeight"], string][] = [
  ["absent", undefined, "bold"],
  ["regular", "regular", "400"],
  ["medium", "medium", "500"],
  ["bold", "bold", "700"],
];

describe("button font weight through MJML", () => {
  it.each(CASES)(
    "%s compiles to font-weight:%s",
    async (_label, fontWeight, css) => {
      const block = createButtonBlock({
        text: "Go",
        url: "https://example.com",
        ...(fontWeight === undefined ? {} : { fontWeight }),
      });
      const mjml = renderBlock(block, ctx);
      expect(mjml).toContain(`font-weight="${css}"`);

      const style = anchorStyle(await compile(wrapBlock(mjml)));
      expect(style).toContain(`font-weight:${css}`);
    },
  );
});
