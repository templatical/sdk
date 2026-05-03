import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createTitleBlock,
  createImageBlock,
  createVideoBlock,
  createSectionBlock,
  createSpacerBlock,
  createParagraphBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";
import { renderBlock, RenderContext } from "../src";
import { convertMergeTagsToValues } from "../src/escape";

/**
 * Round-trip tests: compile renderer's MJML output through mjml@5 and
 * assert on the resulting HTML matches the user's design intent.
 * String-presence checks on the MJML alone wouldn't catch bugs where MJML
 * silently drops attrs or emits unexpected wrapper markup.
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

function makeContent(blocks: TemplateContent["blocks"]): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks,
  };
}

describe("title heading does not nest <p>", () => {
  it("default title content `<p>...</p>` should not yield `<h2><p>...</p></h2>` in HTML", async () => {
    const block = createTitleBlock({
      content: "<p>Hello</p>",
      level: 2,
    } as Parameters<typeof createTitleBlock>[0]);

    const mjml = renderBlock(block, ctx);
    const html = await compile(wrapBlock(mjml));

    // Block-level <p> inside <h2> is invalid HTML — h2 is a heading element
    // that cannot contain block flow. Expect the renderer to strip the
    // wrapping <p> from title content.
    expect(html).not.toMatch(/<h2[^>]*>\s*<p[^>]*>/i);
  });

  it("h1 title with default <p> wrapper should not nest <p> inside <h1>", async () => {
    const block = createTitleBlock({
      content: "<p>Big title</p>",
      level: 1,
    } as Parameters<typeof createTitleBlock>[0]);

    const mjml = renderBlock(block, ctx);
    const html = await compile(wrapBlock(mjml));

    expect(html).not.toMatch(/<h1[^>]*>\s*<p[^>]*>/i);
  });
});

describe("column widths sum to 100%", () => {
  it("three-column layout columns should sum to 100% in compiled HTML", async () => {
    const section = createSectionBlock({
      columns: "3",
      children: [
        [createParagraphBlock({ content: "<p>A</p>" } as any)],
        [createParagraphBlock({ content: "<p>B</p>" } as any)],
        [createParagraphBlock({ content: "<p>C</p>" } as any)],
      ],
    } as Parameters<typeof createSectionBlock>[0]);

    const mjml = await renderToMjml(makeContent([section]));

    // The renderer-emitted MJML widths must sum to 100% (not 99.99%).
    const widthMatches = [...mjml.matchAll(/<mj-column\s+width="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(widthMatches).toHaveLength(3);

    const numeric = widthMatches.map((w) => parseFloat(w.replace("%", "")));
    const sum = numeric.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });

  it("1-2 layout columns should sum to 100%", async () => {
    const section = createSectionBlock({
      columns: "1-2",
      children: [
        [createParagraphBlock({ content: "<p>A</p>" } as any)],
        [createParagraphBlock({ content: "<p>B</p>" } as any)],
      ],
    } as Parameters<typeof createSectionBlock>[0]);

    const mjml = await renderToMjml(makeContent([section]));
    const widthMatches = [...mjml.matchAll(/<mj-column\s+width="([^"]+)"/g)].map(
      (m) => m[1],
    );
    const numeric = widthMatches.map((w) => parseFloat(w.replace("%", "")));
    const sum = numeric.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });
});

describe("target=_blank links carry rel=noopener (image, video)", () => {
  it("image with linkOpenInNewTab=true should emit rel=noopener in compiled HTML", async () => {
    const block = createImageBlock({
      src: "https://example.com/x.png",
      alt: "x",
      linkUrl: "https://example.com",
      linkOpenInNewTab: true,
    } as Parameters<typeof createImageBlock>[0]);

    const mjml = renderBlock(block, ctx);
    const html = await compile(wrapBlock(mjml));

    // Find the <a> tag wrapping the image and assert it has rel=noopener.
    const anchorMatch = html.match(/<a[^>]*target="_blank"[^>]*>/);
    expect(anchorMatch).not.toBeNull();
    expect(anchorMatch![0]).toMatch(/rel="[^"]*noopener/);
  });

  it("video block always opens in new tab — should also carry rel=noopener", async () => {
    const block = createVideoBlock({
      url: "https://vimeo.com/123456",
    } as Parameters<typeof createVideoBlock>[0]);

    const mjml = renderBlock(block, ctx);
    const html = await compile(wrapBlock(mjml));

    const anchorMatch = html.match(/<a[^>]*target="_blank"[^>]*>/);
    expect(anchorMatch).not.toBeNull();
    expect(anchorMatch![0]).toMatch(/rel="[^"]*noopener/);
  });
});

describe("zero-height spacer", () => {
  it("spacer with height=0 should not emit visible vertical space in HTML", async () => {
    const block = createSpacerBlock({
      height: 0,
    } as Parameters<typeof createSpacerBlock>[0]);

    const mjml = renderBlock(block, ctx);
    const html = await compile(wrapBlock(mjml));

    // No emitted <td height="something-greater-than-zero"> from this spacer.
    // We assert the literal "0px" is the height source — Outlook may still
    // emit a 1px line for height=0, but at MJML→HTML level the cell should
    // request 0px height.
    expect(mjml).toContain('height="0px"');
    // Nothing in the spacer's own emitted HTML should claim a positive height.
    expect(html).not.toMatch(/style="[^"]*height:\s*[1-9]\d*px/);
  });
});

describe("custom block backgroundColor reaches HTML", () => {
  it("CustomBlock styles.backgroundColor must compile to container-background-color in HTML", async () => {
    // Custom blocks are dispatched through renderCustom which receives
    // pre-rendered HTML. Construct a fake CustomBlock and feed pre-rendered
    // HTML via the context map.
    const customBlock = {
      id: "cb1",
      type: "custom" as const,
      customType: "test",
      fieldValues: {},
      styles: {
        backgroundColor: "#fffbeb",
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const context = new RenderContext(
      600,
      [],
      "Arial, sans-serif",
      true,
      new Map([["cb1", "<p>custom rendered</p>"]]),
    );
    const mjml = renderBlock(customBlock as any, context);
    const html = await compile(wrapBlock(mjml));
    expect(html.toLowerCase()).toContain("#fffbeb");
  });
});

describe("image with empty src does not emit broken <img>", () => {
  it("image block with src='' should not produce a stray <img src=''> in HTML", async () => {
    const block = createImageBlock({
      src: "",
      alt: "",
    } as Parameters<typeof createImageBlock>[0]);
    const mjml = renderBlock(block, ctx);
    // Either skip the block entirely (preferred — matches video.ts pattern)
    // or emit a placeholder. What MUST NOT happen: a broken <img src="">.
    if (mjml === "") return; // already short-circuited at render time
    const html = await compile(wrapBlock(mjml));
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });
});

describe("title with out-of-range heading level falls back gracefully", () => {
  it("level 5 title should not produce font-size='undefinedpx'", async () => {
    const block = createTitleBlock({
      content: "<p>Hi</p>",
      level: 5 as 1 | 2 | 3 | 4,
    } as Parameters<typeof createTitleBlock>[0]);
    const mjml = renderBlock(block, ctx);
    expect(mjml).not.toContain("undefinedpx");
    expect(mjml).not.toContain("undefined");
    // And MJML compile must succeed without "invalid value" error.
    const result = await mjml2html(wrapBlock(mjml));
    const fontSizeErrors = (result.errors ?? []).filter((e) =>
      /font-size/i.test(e.message),
    );
    expect(fontSizeErrors).toEqual([]);
  });
});

describe("button with openInNewTab=true emits rel=noopener", () => {
  it("button.openInNewTab=true should produce <a rel=noopener> in HTML", async () => {
    const block = {
      id: "b1",
      type: "button" as const,
      text: "Click",
      url: "https://example.com",
      backgroundColor: "#000",
      textColor: "#fff",
      fontSize: 14,
      borderRadius: 4,
      buttonPadding: { top: 10, right: 20, bottom: 10, left: 20 },
      openInNewTab: true,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const mjml = renderBlock(block as any, ctx);
    const html = await compile(wrapBlock(mjml));
    const anchorMatch = html.match(/<a\s[\s\S]*?>/);
    expect(anchorMatch).not.toBeNull();
    expect(anchorMatch![0]).toMatch(/target="_blank"/);
    expect(anchorMatch![0]).toMatch(/rel="[^"]*noopener/);
  });
});

describe("menu items with openInNewTab=true emit rel=noopener", () => {
  it("menu item.openInNewTab=true should produce <a rel=noopener> in HTML", async () => {
    const block = {
      id: "m1",
      type: "menu" as const,
      items: [
        {
          id: "i1",
          text: "Home",
          url: "https://example.com",
          openInNewTab: true,
          bold: false,
          underline: false,
        },
      ],
      separator: "|",
      separatorColor: "#ccc",
      spacing: 8,
      color: "#000",
      fontSize: 14,
      textAlign: "left",
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const mjml = renderBlock(block as any, ctx);
    const html = await compile(wrapBlock(mjml));
    const homeAnchor = html.match(/<a [^>]*href="https:\/\/example\.com"[^>]*>/);
    expect(homeAnchor).not.toBeNull();
    expect(homeAnchor![0]).toMatch(/target="_blank"/);
    expect(homeAnchor![0]).toMatch(/rel="[^"]*noopener/);
  });
});

describe("nested section does not produce invalid MJML", () => {
  it("a SectionBlock placed inside a column must not yield invalid <mj-section> nesting", async () => {
    const innerSection = createSectionBlock({
      columns: "1",
      children: [[createParagraphBlock({ content: "<p>nested</p>" } as any)]],
    } as Parameters<typeof createSectionBlock>[0]);

    const outerSection = createSectionBlock({
      columns: "1",
      children: [[innerSection as any]],
    } as Parameters<typeof createSectionBlock>[0]);

    const mjml = await renderToMjml(makeContent([outerSection]));
    const result = await mjml2html(mjml);
    const sectionErrors = (result.errors ?? []).filter((e) =>
      /mj-section/i.test(e.message),
    );
    expect(sectionErrors).toEqual([]);
  });
});

describe("button color attrs are escaped", () => {
  it("button textColor with quote should not break the MJML attribute", async () => {
    const block = {
      id: "b1",
      type: "button" as const,
      text: "Click",
      url: "https://example.com",
      backgroundColor: "#000",
      textColor: 'red" injected="true',
      fontSize: 14,
      borderRadius: 4,
      buttonPadding: { top: 10, right: 20, bottom: 10, left: 20 },
      openInNewTab: false,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const mjml = renderBlock(block as any, ctx);
    // The injected attribute fragment must not survive into the MJML
    // (escaped to entities, no real attribute opens).
    expect(mjml).not.toContain('injected="true"');
    // mjml@5 may still flag the value as an invalid Color — that's the
    // *correct* rejection. What MUST NOT happen is a structural parse
    // error from the broken-out quote (unmatched-quote / extra-attribute).
    const result = await mjml2html(wrapBlock(mjml));
    const structuralErrors = (result.errors ?? []).filter(
      (e) => !/has invalid value/i.test(e.message),
    );
    expect(structuralErrors).toEqual([]);
  });
});

describe("button with empty URL", () => {
  it('button.url="" should not produce a clickable <a href=""> in HTML', async () => {
    const block = {
      id: "b1",
      type: "button" as const,
      text: "Click",
      url: "",
      backgroundColor: "#000",
      textColor: "#fff",
      fontSize: 14,
      borderRadius: 4,
      buttonPadding: { top: 10, right: 20, bottom: 10, left: 20 },
      openInNewTab: false,
      styles: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const mjml = renderBlock(block as any, ctx);
    const html = await compile(wrapBlock(mjml));
    expect(html).not.toMatch(/href=""/);
  });
});

describe("spacer ignores block.styles.padding (matches canvas)", () => {
  it("spacer height=30 with padding 10/0/10/0 should occupy 30px not 50px", async () => {
    const block = createSpacerBlock({
      height: 30,
      styles: {
        backgroundColor: "",
        padding: { top: 10, right: 0, bottom: 10, left: 0 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    } as Parameters<typeof createSpacerBlock>[0]);

    const mjml = renderBlock(block, ctx);
    // Spacer emits padding="0" regardless of block.styles.padding.
    expect(mjml).toContain('padding="0"');
    expect(mjml).not.toContain('padding="10px 0 10px 0"');

    const html = await compile(wrapBlock(mjml));
    // The spacer's own cell uses padding:0 (no top/bottom padding from
    // block.styles.padding) and a child div carries the 30px height.
    expect(html).toContain("padding:0;word-break");
    expect(html).toMatch(/height:30px;line-height:30px/);
    // Crucially, the user's 10px top/bottom padding should NOT appear in
    // the spacer cell.
    expect(html).not.toMatch(/padding:10px 0 10px 0/);
  });
});

describe("TipTap inline font-size overrides survive the global default", () => {
  it("inline `style=\"font-size:24px\"` on a span inside paragraph content beats the 14px wrapper", async () => {
    const block = createParagraphBlock({
      content: '<p>normal <span style="font-size:24px">BIG</span> normal</p>',
    } as Parameters<typeof createParagraphBlock>[0]);

    const mjml = await renderToMjml(makeContent([block]));
    const html = await compile(mjml);

    expect(html).toContain('<span style="font-size:24px">BIG</span>');
    expect(html).toMatch(/font-size:\s*14px/);
  });
});

describe("empty paragraph emits nothing", () => {
  it("paragraph with empty content should render to empty string", () => {
    const block = createParagraphBlock({
      content: "",
    } as Parameters<typeof createParagraphBlock>[0]);
    const mjml = renderBlock(block, ctx);
    expect(mjml).toBe("");
  });

  it("paragraph with only an empty <p></p> should render to empty string", () => {
    const block = createParagraphBlock({
      content: "<p></p>",
    } as Parameters<typeof createParagraphBlock>[0]);
    const mjml = renderBlock(block, ctx);
    expect(mjml).toBe("");
  });

  it("paragraph with whitespace-only content should render to empty string", () => {
    const block = createParagraphBlock({
      content: "<p>   </p>",
    } as Parameters<typeof createParagraphBlock>[0]);
    const mjml = renderBlock(block, ctx);
    expect(mjml).toBe("");
  });
});

describe("paragraph default font-size matches canvas (14px)", () => {
  it("paragraph without explicit font-size should render at 14px in HTML", async () => {
    const block = createParagraphBlock({
      content: "<p>regular text</p>",
    } as Parameters<typeof createParagraphBlock>[0]);

    const mjml = await renderToMjml(makeContent([block]));
    const html = await compile(mjml);

    // The mj-text default set in <mj-attributes> should propagate down to
    // every paragraph that doesn't override it. mjml@5's intrinsic default
    // is 13px, which would not match the editor canvas (Tailwind text-sm = 14px).
    const textCells = html.match(/font-size:\s*14px/g) ?? [];
    expect(textCells.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/font-size:\s*13px/);
  });
});

describe("nested merge tag spans", () => {
  it("editor cannot produce nested data-merge-tag spans (atom node) — skip if no factory path exists", () => {
    // Direct check on convertMergeTagsToValues — the existing escape.test.ts
    // pins the buggy "stray </span>" output. Confirm the regex still has
    // the bug so we know the contract is unchanged.
    const html =
      '<span data-merge-tag="{{outer}}"><span data-merge-tag="{{inner}}">Inner</span></span>';
    const result = convertMergeTagsToValues(html);
    // If this expectation flips, a fix landed and we need to revisit.
    expect(result).toBe("{{outer}}</span>");
  });
});
