import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createParagraphBlock,
  createTitleBlock,
  createHtmlBlock,
  createDefaultTemplateContent,
  RICH_TEXT_SPACING,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * MJML's core skeleton injects `p { display:block;margin:13px 0; }` into every
 * compiled document, and injects nothing at all for `ul`/`ol`/`li` — those fall
 * through to each client's UA stylesheet. Neither matches the editor canvas, so
 * the WYSIWYG promise breaks the moment a template has more than one paragraph
 * (issue #616).
 *
 * The renderer answers both with one scoped `<mj-style inline="inline">` block,
 * which MJML runs through juice — so the declarations land as real inline styles
 * that survive clients stripping `<style>` from the head.
 *
 * These tests compile through the actual MJML compiler: asserting on the MJML
 * string alone would not prove juice inlined anything, nor that the scoping
 * kept consumer HTML blocks out of it.
 */

async function compile(content: TemplateContent): Promise<string> {
  const mjml = await renderToMjml(content, { allowHtmlBlocks: true });
  const result = await mjml2html(mjml);
  expect(result.errors).toEqual([]);
  return result.html;
}

/** Every `<p>` open tag in document order. */
function paragraphTags(html: string): string[] {
  return html.match(/<p\b[^>]*>/g) ?? [];
}

function contentWith(...blocks: TemplateContent["blocks"]): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  return content;
}

describe("rich text spacing in the compiled email", () => {
  it("inlines the canvas paragraph gap onto every paragraph", async () => {
    const block = createParagraphBlock();
    block.content = "<p>First.</p><p>Second.</p><p>Third.</p>";

    const tags = paragraphTags(await compile(contentWith(block)));

    expect(tags).toHaveLength(3);
    expect(tags[0]).toContain(`margin: 0 0 ${RICH_TEXT_SPACING.paragraphGap}px`);
    expect(tags[1]).toContain(`margin: 0 0 ${RICH_TEXT_SPACING.paragraphGap}px`);
  });

  it("zeroes the trailing gap so the block's own padding is the only bottom space", async () => {
    const block = createParagraphBlock();
    block.content = "<p>First.</p><p>Last.</p>";

    const tags = paragraphTags(await compile(contentWith(block)));

    // juice resolves `:last-child` structurally at build time, so the reset
    // arrives as an inline declaration rather than being dropped with the
    // `<style>` block it came from.
    expect(tags[1]).toContain("margin-bottom: 0");
    expect(tags[0]).not.toContain("margin-bottom: 0");
  });

  it("merges into the alignment style TipTap already wrote on the paragraph", async () => {
    const block = createParagraphBlock();
    block.content = '<p style="text-align: center">Centred.</p>';

    const [tag] = paragraphTags(await compile(contentWith(block)));

    // Clobbering the attribute instead of merging would silently drop every
    // per-paragraph alignment in the template.
    expect(tag).toContain("text-align: center");
    expect(tag).toContain("margin");
  });

  it("leaves a consumer HTML block's paragraphs untouched", async () => {
    const paragraph = createParagraphBlock();
    paragraph.content = "<p>Ours.</p>";
    const html = createHtmlBlock();
    html.content = "<p>Consumer markup.</p>";

    const tags = paragraphTags(await compile(contentWith(paragraph, html)));

    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain("margin");
    // The editor previews an HTML block in a sandboxed `srcdoc` iframe, on UA
    // defaults — so styling it here would trade the paragraph-block mismatch
    // for an HTML-block one, and would beat the consumer's own stylesheet.
    expect(tags[1]).toBe("<p>");
  });

  it("inlines the canvas list geometry, which MJML resets for nobody", async () => {
    const block = createParagraphBlock();
    block.content = "<ul><li>one</li><li>two</li></ul>";

    const compiled = await compile(contentWith(block));
    const [ul] = compiled.match(/<ul\b[^>]*>/g) ?? [];
    const lis = compiled.match(/<li\b[^>]*>/g) ?? [];

    expect(ul).toContain(`margin: ${RICH_TEXT_SPACING.listMarginY}px 0`);
    expect(ul).toContain(`padding-left: ${RICH_TEXT_SPACING.listPaddingLeft}px`);
    expect(lis).toHaveLength(2);
    expect(lis[0]).toContain(`margin: ${RICH_TEXT_SPACING.listItemMarginY}px 0`);
  });

  it("spaces the paragraphs of a multi-paragraph title too", async () => {
    const block = createTitleBlock();
    // `unwrapParagraph` only strips a single outer `<p>`, so a title the user
    // pressed Enter in keeps its paragraphs and needs the same treatment.
    block.content = "<p>Line one.</p><p>Line two.</p>";

    const tags = paragraphTags(await compile(contentWith(block)));

    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain(`margin: 0 0 ${RICH_TEXT_SPACING.paragraphGap}px`);
  });

  it("overrides MJML's own 13px paragraph rule rather than racing it", async () => {
    const block = createParagraphBlock();
    block.content = "<p>Only.</p>";

    const compiled = await compile(contentWith(block));

    // The skeleton rule is still in the head — we override it, we don't remove
    // it. An inline style beats it in every client, and in a client that strips
    // `<style>` both are gone together rather than disagreeing.
    expect(compiled).toContain("p { display:block;margin:13px 0; }");
    expect(paragraphTags(compiled)[0]).toContain("margin: 0 0");
  });

  it("keeps the visibility class when a block is also hidden on a viewport", async () => {
    const block = createParagraphBlock();
    block.content = "<p>Mobile only.</p>";
    block.visibility = { desktop: false, mobile: true };

    const mjml = await renderToMjml(contentWith(block));

    // Both classes travel on one `css-class` attribute; emitting a second
    // attribute would make MJML keep only one of them.
    expect(mjml).toContain('css-class="tpl-hide-desktop tpl-rich-text"');
    expect(mjml).not.toMatch(/css-class="[^"]*"[^>]*css-class=/);
  });
});
