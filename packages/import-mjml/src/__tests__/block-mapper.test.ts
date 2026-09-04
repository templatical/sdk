import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import { describe, expect, it } from "vitest";
import type {
  ButtonBlock,
  DividerBlock,
  ImageBlock,
  SpacerBlock,
} from "@templatical/types";
import { buildAttributeCascade } from "../attribute-resolver";
import { convertElement } from "../block-mapper";
import type { ConvertContext } from "../block-base";

function ctxFor(mjml: string): { ctx: ConvertContext; $: CheerioAPI } {
  const $ = load(mjml, { xml: { xmlMode: false, recognizeSelfClosing: true } });
  return {
    $,
    ctx: {
      $,
      cascade: buildAttributeCascade($),
      containerWidth: 600,
      warnings: [],
    },
  };
}

function convert(mjml: string, selector: string) {
  const { ctx, $ } = ctxFor(`<mjml><mj-body>${mjml}</mj-body></mjml>`);
  const $el = $(selector).first() as unknown as Cheerio<Element>;
  return { result: convertElement($el, ctx), warnings: ctx.warnings };
}

describe("mj-image", () => {
  it("converts src, alt and align", () => {
    const { result } = convert(
      '<mj-image src="a.png" alt="A cat" align="left" width="300px" />',
      "mj-image",
    );
    const block = result!.block as ImageBlock;

    expect(block.type).toBe("image");
    expect(block.src).toBe("a.png");
    expect(block.alt).toBe("A cat");
    expect(block.align).toBe("left");
    expect(block.width).toBe(300);
    expect(result!.entry).toEqual({
      sourceTag: "mj-image",
      templaticalBlockType: "image",
      status: "converted",
    });
  });

  it('restores width "full" when the px width equals the container width', () => {
    const { result } = convert(
      '<mj-image src="a.png" width="600px" />',
      "mj-image",
    );
    expect((result!.block as ImageBlock).width).toBe("full");
  });

  it("reads a link and its new-tab target", () => {
    const { result } = convert(
      '<mj-image src="a.png" href="https://x.test" target="_blank" />',
      "mj-image",
    );
    const block = result!.block as ImageBlock;

    expect(block.linkUrl).toBe("https://x.test");
    expect(block.linkOpenInNewTab).toBe(true);
  });

  it("reads a decorative image from role=presentation", () => {
    const { result } = convert(
      '<mj-image src="a.png" role="presentation" />',
      "mj-image",
    );
    const block = result!.block as ImageBlock;

    expect(block.decorative).toBe(true);
    expect(block.alt).toBe("");
  });

  it("reads padding and border radius", () => {
    const { result } = convert(
      '<mj-image src="a.png" padding="5px 10px" border-radius="8px" />',
      "mj-image",
    );
    const block = result!.block as ImageBlock;

    expect(block.styles.padding).toEqual({
      top: 5,
      right: 10,
      bottom: 5,
      left: 10,
    });
    expect(block.borderRadius).toBe(8);
  });

  it("omits borderRadius when the attribute is absent", () => {
    const { result } = convert('<mj-image src="a.png" />', "mj-image");
    expect("borderRadius" in result!.block!).toBe(false);
  });

  it("returns null for an image with no src", () => {
    const { result } = convert("<mj-image />", "mj-image");
    expect(result).toBe(null);
  });
});

describe("mj-button", () => {
  it("converts text, url and appearance", () => {
    const { result } = convert(
      '<mj-button href="https://x.test" background-color="#ff6600" color="#ffffff" font-size="16px" border-radius="4px" inner-padding="12px 24px" align="right" padding="10px">Buy now</mj-button>',
      "mj-button",
    );
    const block = result!.block as ButtonBlock;

    expect(block.type).toBe("button");
    expect(block.text).toBe("Buy now");
    expect(block.url).toBe("https://x.test");
    expect(block.backgroundColor).toBe("#ff6600");
    expect(block.textColor).toBe("#ffffff");
    expect(block.fontSize).toBe(16);
    expect(block.borderRadius).toBe(4);
    expect(block.buttonPadding).toEqual({
      top: 12,
      right: 24,
      bottom: 12,
      left: 24,
    });
    expect(block.align).toBe("right");
    expect(block.styles.padding).toEqual({
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
    expect(result!.entry.status).toBe("converted");
  });

  it("reads the new-tab target", () => {
    const { result } = convert(
      '<mj-button href="https://x.test" target="_blank">Go</mj-button>',
      "mj-button",
    );
    expect((result!.block as ButtonBlock).openInNewTab).toBe(true);
  });

  it("keeps the factory borderRadius and buttonPadding when absent from the source", () => {
    const { result } = convert(
      '<mj-button href="https://x.test">Go</mj-button>',
      "mj-button",
    );
    const block = result!.block as ButtonBlock;

    expect(block.borderRadius).toBe(6);
    expect(block.buttonPadding).toEqual({
      top: 12,
      right: 24,
      bottom: 12,
      left: 24,
    });
  });

  it("honours an explicit zero borderRadius and inner-padding rather than falling back", () => {
    const { result } = convert(
      '<mj-button href="https://x.test" border-radius="0" inner-padding="0">Go</mj-button>',
      "mj-button",
    );
    const block = result!.block as ButtonBlock;

    expect(block.borderRadius).toBe(0);
    expect(block.buttonPadding).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("returns null for a button with no label", () => {
    const { result } = convert(
      '<mj-button href="https://x.test">   </mj-button>',
      "mj-button",
    );
    expect(result).toBe(null);
  });
});

describe("mj-divider", () => {
  it("converts thickness, style and colour", () => {
    const { result } = convert(
      '<mj-divider border-width="2px" border-style="dashed" border-color="#cccccc" padding="20px" />',
      "mj-divider",
    );
    const block = result!.block as DividerBlock;

    expect(block.type).toBe("divider");
    expect(block.thickness).toBe(2);
    expect(block.lineStyle).toBe("dashed");
    expect(block.color).toBe("#cccccc");
    expect(result!.entry.status).toBe("converted");
  });

  it("narrows an unsupported border style to solid", () => {
    const { result } = convert(
      '<mj-divider border-style="groove" />',
      "mj-divider",
    );
    expect((result!.block as DividerBlock).lineStyle).toBe("solid");
  });

  it("keeps the factory thickness when border-width is absent", () => {
    const { result } = convert("<mj-divider />", "mj-divider");
    expect((result!.block as DividerBlock).thickness).toBe(1);
  });

  it("honours an explicit zero border-width rather than falling back", () => {
    const { result } = convert('<mj-divider border-width="0" />', "mj-divider");
    expect((result!.block as DividerBlock).thickness).toBe(0);
  });
});

describe("mj-spacer", () => {
  it("converts height", () => {
    const { result } = convert('<mj-spacer height="32px" />', "mj-spacer");
    const block = result!.block as SpacerBlock;

    expect(block.type).toBe("spacer");
    expect(block.height).toBe(32);
    expect(result!.entry.status).toBe("converted");
  });

  it("keeps the factory height when the attribute is absent", () => {
    const { result } = convert("<mj-spacer />", "mj-spacer");
    expect((result!.block as SpacerBlock).height).toBe(24);
  });

  it("honours an explicit zero height rather than falling back", () => {
    const { result } = convert('<mj-spacer height="0" />', "mj-spacer");
    expect((result!.block as SpacerBlock).height).toBe(0);
  });
});

describe("visibility", () => {
  it("carries css-class visibility onto the block", () => {
    const { result } = convert(
      '<mj-spacer height="10px" css-class="tpl-hide-mobile" />',
      "mj-spacer",
    );
    expect(result!.block!.visibility).toEqual({ desktop: true, mobile: false });
  });

  it("warns about foreign css classes and does not set visibility", () => {
    const { result, warnings } = convert(
      '<mj-spacer height="10px" css-class="promo" />',
      "mj-spacer",
    );

    expect("visibility" in result!.block!).toBe(false);
    expect(warnings).toEqual([
      'Dropped CSS class "promo" on <mj-spacer> — consumer CSS has no Templatical equivalent.',
    ]);
  });
});

describe("the fallback ladder", () => {
  it("converts mj-raw to an html block, preserving inner markup", () => {
    const { result } = convert(
      "<mj-raw><!--[if mso]>x<![endif]--></mj-raw>",
      "mj-raw",
    );

    expect(result!.block!.type).toBe("html");
    expect((result!.block as { content: string }).content).toBe(
      "<!--[if mso]>x<![endif]-->",
    );
    expect(result!.entry).toEqual({
      sourceTag: "mj-raw",
      templaticalBlockType: "html",
      status: "converted",
    });
  });

  it("falls back to an html block for mj-hero, keeping the outer markup", () => {
    const { result } = convert(
      '<mj-hero background-color="#000000"><mj-text>hi</mj-text></mj-hero>',
      "mj-hero",
    );

    expect(result!.block!.type).toBe("html");
    const content = (result!.block as { content: string }).content;
    // Outer serialization: the mj-hero element's own attribute must survive
    // alongside its children. `$el.html()` (inner-only) would drop it, which
    // is exactly the bug this assertion catches.
    expect(content).toContain('background-color="#000000"');
    expect(content).toContain("<mj-text>hi</mj-text>");
    expect(result!.entry).toEqual({
      sourceTag: "mj-hero",
      templaticalBlockType: "html",
      status: "html-fallback",
      note: "<mj-hero> has no Templatical block equivalent; the original markup is preserved.",
    });
  });

  it("falls back for mj-carousel and mj-accordion too", () => {
    expect(convert("<mj-carousel />", "mj-carousel").result!.entry.status).toBe(
      "html-fallback",
    );
    expect(
      convert("<mj-accordion />", "mj-accordion").result!.entry.status,
    ).toBe("html-fallback");
  });

  it("skips mj-include and names the path it could not resolve", () => {
    const { result } = convert(
      '<mj-include path="./header.mjml" />',
      "mj-include",
    );

    expect(result).toEqual({
      block: null,
      entry: {
        sourceTag: "mj-include",
        templaticalBlockType: null,
        status: "skipped",
        note: 'Cannot resolve <mj-include path="./header.mjml"> — the importer reads a single string and has no filesystem access. Inline the include before importing.',
      },
    });
  });

  it("falls back for an unknown mj-* tag, keeping its own attributes", () => {
    const { result } = convert(
      '<mj-widget data-widget-id="42" />',
      "mj-widget",
    );

    expect(result!.block!.type).toBe("html");
    // Outer serialization: mj-widget has no children, so this only passes
    // when the element's own attribute is captured — `$el.html()`
    // (inner-only) would return an empty string here.
    expect((result!.block as { content: string }).content).toContain(
      'data-widget-id="42"',
    );
    expect(result!.entry.status).toBe("html-fallback");
    expect(result!.entry.note).toBe(
      "<mj-widget> is not a known MJML element (a custom component?); the original markup is preserved.",
    );
  });
});
