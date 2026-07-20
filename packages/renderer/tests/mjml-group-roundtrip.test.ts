import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createSectionBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * `stackOnMobile: false` renders columns inside an `<mj-group>` so MJML keeps
 * them side-by-side on mobile instead of stacking (its default). Compiling
 * through the real MJML compiler proves the mechanism end-to-end: grouped
 * columns get an inline `width:50%` (they hold their proportion on mobile),
 * whereas default columns get inline `width:100%` and only reach 50% via a
 * desktop media query — i.e. they collapse to full-width (stack) on mobile.
 * A string-only MJML assertion couldn't tell those two apart.
 */

// Inline style MJML gives a column that stays side-by-side on mobile. In the
// stacking (default) output the column is inline `width:100%` and this exact
// substring never appears (the 50% lives only in a desktop media query).
const SIDE_BY_SIDE_MARKER = "display:inline-block;vertical-align:top;width:50%";

function twoColumn(stackOnMobile?: boolean): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [
      createSectionBlock({
        columns: "2",
        stackOnMobile,
        children: [
          [createParagraphBlock({ content: "<p>LEFTCELL</p>" })],
          [createParagraphBlock({ content: "<p>RIGHTCELL</p>" })],
        ],
      }),
    ],
  };
}

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

describe("mj-group round-trip through MJML compiler", () => {
  it("keeps columns side-by-side on mobile when stackOnMobile is false", async () => {
    const mjml = await renderToMjml(twoColumn(false));
    expect(mjml).toContain("<mj-group>");

    const html = await compile(mjml);
    expect(html).toContain("LEFTCELL");
    expect(html).toContain("RIGHTCELL");
    expect(html).toContain(SIDE_BY_SIDE_MARKER);
  });

  it("omits the group so columns stack on mobile by default", async () => {
    const mjml = await renderToMjml(twoColumn(undefined));
    expect(mjml).not.toContain("<mj-group>");

    const html = await compile(mjml);
    expect(html).toContain("LEFTCELL");
    expect(html).toContain("RIGHTCELL");
    expect(html).not.toContain(SIDE_BY_SIDE_MARKER);
  });
});
