import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createImageBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * `border-radius` on `mj-image` compiles into the `<img>`'s inline style, which
 * is the only place it can live: there is no HTML attribute for it, so a string
 * check on the MJML alone would not prove a recipient ever sees round corners.
 * These compile the renderer's output and assert on the emitted `<img>`.
 *
 * The circle case is the one users actually reach for (avatar and portrait
 * layouts), and it only works because the renderer emits the radius verbatim
 * rather than clamping it to something "reasonable".
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

describe("image border radius round-trip through MJML compiler", () => {
  it("carries an explicit radius into the compiled img's style", async () => {
    const block = createImageBlock({
      src: "https://example.com/img.png",
      width: 300,
      borderRadius: 12,
    });

    const mjml = renderBlock(block, ctx);
    expect(mjml).toContain('border-radius="12px"');

    expect(imgTag(await compile(wrapBlock(mjml)))).toContain(
      "border-radius:12px",
    );
  });

  it("passes a radius large enough to round a square image to a circle", async () => {
    const block = createImageBlock({
      src: "https://example.com/portrait.png",
      width: 240,
      height: 240,
      borderRadius: 999,
    });

    expect(imgTag(await compile(wrapBlock(renderBlock(block, ctx))))).toContain(
      "border-radius:999px",
    );
  });

  it("emits nothing when the radius is unset or zero", async () => {
    for (const borderRadius of [undefined, 0]) {
      const block = createImageBlock({
        src: "https://example.com/img.png",
        width: 300,
        borderRadius,
      });

      const mjml = renderBlock(block, ctx);
      expect(mjml).not.toContain("border-radius");
      expect(imgTag(await compile(wrapBlock(mjml)))).not.toContain(
        "border-radius",
      );
    }
  });
});
