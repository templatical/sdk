import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import { createButtonBlock } from "@templatical/types";
import { renderBlock, RenderContext } from "../src";

/**
 * `align` on `mj-button` lands on the table cell that wraps the button, which
 * is what actually moves it within the column. A string check on the MJML
 * alone would pass even if MJML dropped the attribute, so these compile the
 * renderer's output and assert on the emitted cell.
 *
 * Note the button's own inner `<td>` carries a hardcoded `align="center"` from
 * MJML — hence the assertions anchor on the outer cell (the one carrying
 * `word-break`) rather than searching the whole document for an align value.
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

/** The alignment of the cell MJML wraps the button in. */
function buttonCellAlign(html: string): string | null {
  const match = html.match(/align="(left|center|right)"[^>]*word-break/);
  return match ? match[1] : null;
}

describe("button align round-trip through MJML compiler", () => {
  it.each(["left", "center", "right"] as const)(
    "carries align=%s into the compiled cell",
    async (align) => {
      const block = createButtonBlock({ text: "Go", url: "#", align });

      const mjml = renderBlock(block, ctx);
      expect(mjml).toContain(`align="${align}"`);

      const html = await compile(wrapBlock(mjml));
      expect(buttonCellAlign(html)).toBe(align);
    },
  );

  it("renders a button with no stored align exactly like a centered one", async () => {
    const legacy = createButtonBlock({ text: "Go", url: "#" });
    delete (legacy as { align?: unknown }).align;
    const centered = createButtonBlock({
      id: legacy.id,
      text: "Go",
      url: "#",
      align: "center",
    });

    const legacyHtml = await compile(wrapBlock(renderBlock(legacy, ctx)));
    const centeredHtml = await compile(wrapBlock(renderBlock(centered, ctx)));

    expect(legacyHtml).toBe(centeredHtml);
  });
});
