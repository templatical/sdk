import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createImageBlock, createVideoBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * `height` on `mj-image` is a Unit attribute that accepts only `px` or `auto`.
 * A bare number is a validation error and MJML drops the attribute, so the px
 * suffix the renderer appends is load-bearing — and invisible to a string check
 * on the MJML alone. These compile the renderer's output and assert on the
 * emitted `<img>`, where MJML writes the height twice: into the inline style
 * (respected by webmail) and into the HTML attribute (respected by Outlook).
 *
 * `compile()` asserting no errors is what catches a non-px value: MJML reports
 * it in `result.errors` rather than throwing.
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

/** The `<img>` MJML emits for an mj-image, whitespace-normalized. */
function imgTag(html: string): string {
  const match = html.replace(/\s+/g, " ").match(/<img[^>]*>/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("image height round-trip through MJML compiler", () => {
  it("carries an explicit height into both the style and the attribute", async () => {
    const block = createImageBlock({
      src: "https://example.com/img.png",
      width: 300,
      height: 180,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('height="180px"');

    const img = imgTag(await compile(wrapBlock(mjml)));
    expect(img).toContain("height:180px");
    expect(img).toContain('height="180"');
  });

  it("falls back to MJML's auto height when none is set", async () => {
    const block = createImageBlock({
      src: "https://example.com/img.png",
      width: 300,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).not.toContain("height=");

    const img = imgTag(await compile(wrapBlock(mjml)));
    expect(img).toContain("height:auto");
    expect(img).toContain('height="auto"');
  });

  it("carries a video block's height through the same path", async () => {
    const block = createVideoBlock({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      height: 220,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('height="220px"');

    const img = imgTag(await compile(wrapBlock(mjml)));
    expect(img).toContain("height:220px");
    expect(img).toContain('height="220"');
  });
});
