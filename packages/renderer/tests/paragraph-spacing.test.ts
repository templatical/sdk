import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createTitleBlock,
  createDefaultTemplateContent,
  RICH_TEXT_SPACING,
} from "@templatical/types";
import type { ParagraphBlock, TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * `ParagraphBlock.paragraphSpacing` is the per-block gap between the paragraphs
 * inside one rich-text block. Absent means the built-in
 * `RICH_TEXT_SPACING.paragraphGap`.
 *
 * The renderer emits one rule per *distinct* gap in the document and puts the
 * matching class on each block, rather than one rule plus per-block overrides.
 * That is not a style preference: an override rule would have the same
 * specificity as the base rule (one class + one type each), so source order
 * would decide it and the base rule would win — see the "no base rule" test.
 */

function paragraph(
  content: string,
  paragraphSpacing?: number,
): ParagraphBlock {
  const block = createParagraphBlock();
  block.content = content;
  if (paragraphSpacing !== undefined) {
    block.paragraphSpacing = paragraphSpacing;
  }
  return block;
}

function contentWith(...blocks: TemplateContent["blocks"]): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return content;
}

async function compile(content: TemplateContent): Promise<string> {
  const result = await mjml2html(await renderToMjml(content));
  expect(result.errors).toEqual([]);
  return result.html;
}

function paragraphTags(html: string): string[] {
  return html.match(/<p\b[^>]*>/g) ?? [];
}

describe("per-block paragraph spacing", () => {
  it("gives each block its own gap", async () => {
    const html = await compile(
      contentWith(
        paragraph("<p>Tight one.</p><p>Tight two.</p>", 4),
        paragraph("<p>Airy one.</p><p>Airy two.</p>", 20),
      ),
    );

    const tags = paragraphTags(html);

    expect(tags).toHaveLength(4);
    expect(tags[0]).toContain("margin: 0 0 4px");
    expect(tags[1]).toContain("margin-bottom: 0");
    expect(tags[2]).toContain("margin: 0 0 20px");
    expect(tags[3]).toContain("margin-bottom: 0");
  });

  it("uses the built-in gap for a block that sets none", async () => {
    const html = await compile(
      contentWith(paragraph("<p>One.</p><p>Two.</p>")),
    );

    expect(paragraphTags(html)[0]).toContain(
      `margin: 0 0 ${RICH_TEXT_SPACING.paragraphGap}px`,
    );
  });

  it("accepts a zero gap rather than treating it as unset", async () => {
    const html = await compile(
      contentWith(paragraph("<p>One.</p><p>Two.</p>", 0)),
    );

    expect(paragraphTags(html)[0]).toContain("margin: 0 0 0px");
  });

  it("emits one rule per distinct gap, not one per block", async () => {
    const mjml = await renderToMjml(
      contentWith(
        paragraph("<p>a</p><p>b</p>", 4),
        paragraph("<p>c</p><p>d</p>", 4),
        paragraph("<p>e</p><p>f</p>", 20),
      ),
    );

    expect(mjml.match(/\.tpl-rich-text-4 p \{/g)).toHaveLength(1);
    expect(mjml.match(/\.tpl-rich-text-20 p \{/g)).toHaveLength(1);
  });

  it("emits no unversioned paragraph margin rule to compete with them", async () => {
    const mjml = await renderToMjml(
      contentWith(paragraph("<p>a</p><p>b</p>", 4)),
    );

    // `.tpl-rich-text p` and `.tpl-rich-text-4 p` have equal specificity, so a
    // surviving base rule would win on source order and silently flatten every
    // per-block gap back to the default.
    expect(mjml).not.toMatch(/\.tpl-rich-text p \{/);
    // The list rules stay on the unversioned class — they are not settable.
    expect(mjml).toMatch(/\.tpl-rich-text ul, \.tpl-rich-text ol \{/);
  });

  it("carries both the shared class and the gap class on the block", async () => {
    const mjml = await renderToMjml(
      contentWith(paragraph("<p>a</p><p>b</p>", 4)),
    );

    expect(mjml).toContain('css-class="tpl-rich-text tpl-rich-text-4"');
  });

  it("keeps the visibility class alongside both", async () => {
    const block = paragraph("<p>a</p><p>b</p>", 4);
    block.visibility = { desktop: false, mobile: true };

    const mjml = await renderToMjml(contentWith(block));

    expect(mjml).toContain(
      'css-class="tpl-hide-desktop tpl-rich-text tpl-rich-text-4"',
    );
  });

  it("spaces a title's paragraphs by the built-in gap, which it cannot set", async () => {
    const title = createTitleBlock();
    title.content = "<p>Line one.</p><p>Line two.</p>";

    const html = await compile(contentWith(title));

    expect(paragraphTags(html)[0]).toContain(
      `margin: 0 0 ${RICH_TEXT_SPACING.paragraphGap}px`,
    );
  });
});
